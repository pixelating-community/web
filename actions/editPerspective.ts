"use server";

import { randomUUID, type UUID } from "node:crypto";
import {
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

import { addSample } from "@/actions/addSample";
import { getEditById } from "@/actions/getEditByID";
import { getTopic } from "@/actions/getTopic";
import { isLocked } from "@/actions/isLocked";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { img } from "@/lib/img";
import { parseSampleUrl } from "@/lib/parseSampleUrl";
import { s3Client } from "@/lib/s3";

const schema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  token: z.string().min(1),
  perspective: z.string().min(1),
  description: z.string().nullable(),
  pixelat_ing: z.string().nullish(),
  sample_id: z.uuid().nullish(),
  sample: z.string().nullish(),
});

export const editPerspective = async ({
  id,
  name,
  formData,
}: {
  id: UUID;
  name: string;
  formData: FormData;
}): Promise<{ message?: string; result?: unknown }> => {
  try {
    const data = parseFormData(formData, id, name);
    const perspectiveRow = await getPerspectiveRow(id);
    if (!perspectiveRow) return { message: "Perspective not found" };

    const topic = await getTopic({ name });
    const locked = await isLocked({ id: topic.id });
    if (locked) {
      data.perspective = encrypt(data.perspective, data.token);
    }

    const isValid = await validateToken(data.token, topic.id);
    if (!isValid) return { message: "Invalid token" };

    const file = formData.get("file") as File;
    const result =
      file && file.size > 0
        ? await handleFileUpload(
            file,
            { ...data, description: data.description || null },
            id,
            perspectiveRow.objective_id,
          )
        : await updatePerspectiveWithoutFile(data, id);

    await handleSampleUpdates(
      {
        sample: data.sample || "",
        sample_id: data.sample_id ? (data.sample_id as UUID) : null,
      },
      id,
    );

    revalidatePath(`/t/${name}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to edit perspective" };
  }
};

const parseFormData = (formData: FormData, id: UUID, name: string) => {
  return schema.parse({
    id,
    name,
    token: formData.get("token"),
    perspective: formData.get("perspective"),
    description: formData.get("description"),
    pixelat_ing: formData.get("pixelat_ing"),
    sample: formData.get("sample"),
    sample_id: (() => {
      const value = formData.get("sample_id");
      return value === "" ? null : value;
    })(),
  });
};

const getPerspectiveRow = async (id: UUID) => {
  const [row] = await sql`
    SELECT id, objective_id FROM perspectives WHERE id = ${id};
  `;
  return row;
};

const validateToken = async (token: string, topicId: UUID) => {
  const isValid = await sql`
    SELECT token = crypt(${token}, token) FROM topics WHERE id = ${topicId};
  `;
  return isValid.length > 0 && isValid[0]["?column?"] !== false;
};

const handleFileUpload = async (
  file: File,
  data: {
    perspective: string;
    description: string | null;
    pixelat_ing?: string | null;
  },
  id: UUID,
  objectiveId: UUID,
) => {
  const fileBuffer = await file.arrayBuffer();
  const pixelSize = parseInt(data.pixelat_ing || "0", 10);
  const { sharpBuffer, width, height, format } = await img({
    fileBuffer,
    pixelSize,
  });
  const Key = `${randomUUID()}.${format}`;
  const bucketParams: PutObjectCommandInput = {
    Bucket: process.env.BUCKET_NAME,
    Key,
    ContentType: `image/${format}`,
    Body: Buffer.from(sharpBuffer),
    ACL: "public-read",
  };
  await s3Client.send(new PutObjectCommand(bucketParams));

  await sql`
    UPDATE objectives SET src = ${Key}, description = ${data.description}, width = ${width}, height = ${height}
    WHERE id = ${objectiveId};
  `;

  return await sql`
    UPDATE perspectives SET perspective = ${data.perspective}, updated_at = NOW()
    WHERE id = ${id};
  `;
};

const updatePerspectiveWithoutFile = async (
  data: { perspective: string },
  id: UUID,
) => {
  return await sql`
    UPDATE perspectives SET perspective = ${data.perspective}
    WHERE id = ${id};
  `;
};

const handleSampleUpdates = async (
  data: {
    sample: string | null | undefined;
    sample_id: UUID | null | undefined;
  },
  id: UUID,
) => {
  if (data.sample === "") {
    await sql`UPDATE perspectives SET sample_id = NULL WHERE id = ${id}`;
  }

  if (data.sample_id && data.sample) {
    const { start, end, trackName, editName } = parseSampleUrl(data.sample);
    const sample = await sql`
      SELECT id, edit_id, start_at, end_at FROM samples WHERE id = ${data.sample_id};
    `;
    const { name, track_name } = await getEditById({ id: sample[0].edit_id });

    if (
      name === editName &&
      trackName === track_name &&
      (start !== sample[0].start_at || end !== sample[0].end_at)
    ) {
      await sql`
        UPDATE samples SET start_at = ${start}, end_at = ${end} WHERE id = ${data.sample_id};
      `;
    }
  }

  if (!data.sample_id && data.sample) {
    const sampleResult = await addSample({ url: data.sample });
    if (!Array.isArray(sampleResult) || sampleResult.length !== 1) {
      throw new Error("Failed to retrieve sample");
    }
    const sampleId = sampleResult[0].id as UUID;
    await sql`UPDATE perspectives SET sample_id = ${sampleId} WHERE id = ${id};`;
  }
};
