"use server";

import { PutObjectCommandInput, PutObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { isLocked } from "@/actions/isLocked";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { img } from "@/lib/img";
import { s3Client } from "@/lib/s3";
import { z } from "zod";

export async function addPerspective({
  topicId,
  formData,
}: {
  topicId: string;
  formData: FormData;
}) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      perspective: z.string().min(1),
      topicId: z.string().min(1),
      color: z.string().min(1),
      description: z.string().nullish(),
      pixelat_ing: z.string().nullish(),
    });
    const data = schema.parse({
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      topicId,
      color: formData.get("color"),
      description: formData.get("description"),
      pixelat_ing: formData.get("pixelat_ing"),
    });
    const isLock = await isLocked({ topicId: data.topicId });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE topic_id = ${data.topicId};
    `;
    let result = [];

    if (isLock) {
      data.perspective = encrypt(data.perspective, data.token);
    }

    if (isValid.length > 0 && isValid[0]["?column?"] === true) {
      const file = formData.get("file") as File;
      if (file.size > 0) {
        const { pixelat_ing } = data;
        const pixelSize = parseInt(pixelat_ing);
        const fileBuffer = await file.arrayBuffer();
        const { sharpBuffer, width, height, format } = await img({
          fileBuffer,
          pixelSize,
        });
        const Key = `${topicId}_${Date.now()}.${format}`;
        const bucketParams = {
          Bucket: process.env.BUCKET_NAME,
          Key,
          ContentType: file.type,
          Body: Buffer.from(sharpBuffer),
          ACL: "public-read",
        } as unknown as PutObjectCommandInput;
        await s3Client.send(new PutObjectCommand(bucketParams));
        await sql`
          INSERT INTO objectives (topic_id,  objective_key, description, width, height)
          VALUES (${data.topicId}, ${Key}, ${data.description}, ${width}, ${height});
          `;
        result = await sql`
          INSERT INTO perspectives (perspective, topic_id,  color, objective_key)
          VALUES (${data.perspective}, ${data.topicId}, ${data.color}, ${Key});
          `;
      } else {
        result = await sql`
          INSERT INTO perspectives (perspective, topic_id,  color)
          VALUES (${data.perspective}, ${data.topicId}, ${data.color});
          `;
      }
    }

    revalidatePath(`/t/${data.topicId}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create perspective" };
  }
}
