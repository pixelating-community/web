"use server";

import { PutObjectCommandInput, PutObjectCommand } from "@aws-sdk/client-s3";
import { revalidatePath } from "next/cache";
import { isLocked } from "@/actions/isLocked";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { img } from "@/lib/img";
import { s3Client } from "@/lib/s3";
import { z } from "zod";

export async function editPerspective({
  topicId,
  id,
  objective_key,
  formData,
}: {
  topicId: string;
  id: string;
  objective_key: string;
  formData: FormData;
}) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      id: z.string().min(1),
      objective_key: z.string().min(1).nullable(),
      perspective: z.string().min(1),
      topicId: z.string().min(1),
      color: z.string(),
      description: z.string().nullable(),
      pixelat_ing: z.string().nullish(),
    });
    const data = schema.parse({
      topicId,
      id,
      objective_key,
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      color: formData.get("color"),
      description: formData.get("description"),
      pixelat_ing: formData.get("pixelat_ing"),
    });
    let result = [];
    const isLock = await isLocked({ topicId: data.topicId });
    if (isLock) {
      data.perspective = encrypt(data.perspective, data.token);
    }
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE topic_id = ${data.topicId};
    `;
    if (isValid.length > 0 && isValid[0]["?column?"] === true) {
      const file = formData.get("file") as File;
      if (file.size > 0) {
        const fileBuffer = await file.arrayBuffer();
        const { pixelat_ing } = data;
        const pixelSize = parseInt(pixelat_ing);
        const { sharpBuffer, width, height, format } = await img({
          fileBuffer,
          pixelSize,
        });
        const Key = `${topicId}_${Date.now()}.${format}`;
        const bucketParams = {
          Bucket: process.env.BUCKET_NAME,
          Key,
          ContentType: `image/${format}`,
          Body: Buffer.from(sharpBuffer),
          ACL: "public-read",
        } as unknown as PutObjectCommandInput;
        await s3Client.send(new PutObjectCommand(bucketParams));
        await sql`
          UPDATE objectives SET objective_key = ${Key}, description = ${data.description}, width = ${width}, height = ${height}
          WHERE objective_key = ${objective_key};
          `;
        result = await sql`
          UPDATE perspectives SET perspective = ${data.perspective}, color = ${data.color}, objective_key = ${Key}
          WHERE id = ${id};
          `;
      } else {
        if (data.description) {
          await sql`
            UPDATE objectives SET description = ${data.description}
            WHERE objective_key = ${objective_key};
            `;
        }
        result = await sql`
          UPDATE perspectives SET perspective = ${data.perspective}, color = ${data.color}
          WHERE id = ${id};
          `;
      }
    } else {
      console.log("ENTER CORRECT TOKEN");
    }

    revalidatePath(`/t/${data.topicId}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create perspective" };
  }
}
