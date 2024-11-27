"use server";

import { PutObjectCommandInput, PutObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { isLocked } from "@/actions/isLocked";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { img } from "@/lib/img";
import { s3Client } from "@/lib/s3";
import { z } from "zod/v4";
import { addSample } from "@/actions/addSample";
import { randomUUID, UUID } from "crypto";

async function handleFileUpload({ file, data }: { file: File; data: any }) {
  const pixelSize = parseInt(data.pixelat_ing);
  const fileBuffer = await file.arrayBuffer();
  const { sharpBuffer, width, height, format } = await img({
    fileBuffer,
    pixelSize,
  });
  const Key = `${randomUUID()}.${format}`;
  const bucketParams = {
    Bucket: process.env.BUCKET_NAME,
    Key,
    ContentType: file.type,
    Body: Buffer.from(sharpBuffer),
    ACL: "public-read",
  } as unknown as PutObjectCommandInput;
  await s3Client.send(new PutObjectCommand(bucketParams));
  const insertResult = await sql`
    INSERT INTO objectives (src, description, width, height)
    VALUES (${Key}, ${data.description}, ${width}, ${height})
    RETURNING objective_id;
    `;
  const objective_id = insertResult[0]?.objective_id;
  const result = await sql`
    INSERT INTO perspectives (objective_id)
    VALUES (${objective_id});
    `;
  return result;
}

export async function addPerspective({
  topicId,
  name,
  formData,
}: {
  topicId: UUID;
  name: string;
  formData: FormData;
}) {
  try {
    if (!topicId) {
      throw new Error("Topic not found");
    }
    const schema = z.object({
      token: z.string().min(1),
      perspective: z.string().min(1),
      topicId: z.uuid(),
      name: z.string(),
      color: z.string().min(1),
      description: z.string().nullish(),
      pixelat_ing: z.string().nullish(),
      sample: z.url().nullish(),
    });
    const data = schema.parse({
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      topicId,
      name,
      color: formData.get("color"),
      description: formData.get("description"),
      pixelat_ing: formData.get("pixelat_ing"),
      sample: (() => {
        const value = formData.get("sample");
        return value === "" ? null : value;
      })(),
    });
    const isLock = await isLocked({ id: topicId });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE id = ${topicId};
    `;
    let result = [];

    if (isLock) {
      data.perspective = encrypt(data.perspective, data.token);
    }

    if (isValid.length > 0 && isValid[0]["?column?"] === true) {
      const file = formData.get("file") as File;
      if (file && file.size > 0) {
        result = await handleFileUpload({ file, data });
      } else {
        await sql`
          INSERT INTO perspectives (perspective, topic_id,  color)
          VALUES (${data.perspective}, ${topicId}, ${data.color});
        `;

        if (data.sample) {
          await addSample({ url: data.sample });
        }
      }
    }

    revalidatePath(`/t/${name}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create perspective" };
  }
}
