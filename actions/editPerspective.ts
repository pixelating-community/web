"use server";

import { PutObjectCommandInput, PutObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { isLocked } from "@/actions/isLocked";
import { addSample } from "@/actions/addSample";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { img } from "@/lib/img";
import { s3Client } from "@/lib/s3";
import { z } from "zod/v4";
import { randomUUID, UUID } from "crypto";
import { getTopic } from "./getTopic";
import { parseSampleUrl } from "@/lib/parseSampleUrl";
import { getEditById } from "./getEditByID";

const schema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  token: z.string().min(1),
  perspective: z.string().min(1),
  color: z.string(),
  description: z.string().nullable(),
  pixelat_ing: z.string().nullish(),
  sample_id: z.uuid().nullish(),
  sample: z.string().nullish(),
});

export async function editPerspective({
  id,
  name,
  formData,
}: {
  id: UUID;
  name: string;
  formData: FormData;
}) {
  try {
    const data = schema.parse({
      id,
      name,
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      color: formData.get("color"),
      description: formData.get("description"),
      pixelat_ing: formData.get("pixelat_ing"),
      sample: formData.get("sample"),
      sample_id: (() => {
        const value = formData.get("sample_id");
        return value === "" ? null : value;
      })(),
    });

    const [perspectiveRow] = await sql`
      SELECT id, objective_id FROM perspectives WHERE id = ${id};
    `;
    if (!perspectiveRow) return { message: "Perspective not found" };

    const topic = await getTopic({ name });
    const locked = await isLocked({ id: topic.id });
    if (locked) {
      data.perspective = encrypt(data.perspective, data.token);
    }
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE id = ${topic.id};
    `;

    if (isValid.length === 0 && isValid[0]["?column?"] === false) {
      return { message: "Invalid token" };
    }

    const file = formData.get("file") as File;
    let result: Awaited<ReturnType<typeof sql>>;
    if (file && file.size > 0) {
      const fileBuffer = await file.arrayBuffer();
      const pixelSize = parseInt(data.pixelat_ing || "0");
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
        WHERE id = ${perspectiveRow.objective_id};
      `;

      result = await sql`
        UPDATE perspectives SET perspective = ${data.perspective}, description = ${data.description}, color = ${data.color}
        WHERE id = ${id};
      `;
    } else {
      result = await sql`
        UPDATE perspectives SET perspective = ${data.perspective}, color = ${data.color}
        WHERE id = ${id};
      `;
    }

    if (data.sample_id && data.sample) {
      const { start, end, trackName, editName } = parseSampleUrl(data.sample);
      const sample =
        await sql`SELECT id, edit_id, start_at, end_at FROM samples WHERE id = ${data.sample_id}`;
      const { name, track_name } = await getEditById({
        id: sample[0].edit_id,
      });

      if (
        name === editName &&
        trackName === track_name &&
        (start !== sample[0].start_at || end !== sample[0].end_at)
      ) {
        return await sql`UPDATE samples SET start_at = ${start}, end_at = ${end} WHERE id = ${data.sample_id};`;
      }
    }

    if (!data.sample_id && data.sample) {
      const sampleResult = await addSample({ url: data.sample });
      if (!Array.isArray(sampleResult) || sampleResult.length !== 1) {
        throw new Error(
          "addSample did not return an array with one object containing an id"
        );
      }
      const sampleId = sampleResult[0].id as UUID;
      await sql`UPDATE perspectives SET sample_id = ${sampleId} WHERE id = ${id};`;
    }

    revalidatePath(`/t/${name}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to edit perspective" };
  }
}
