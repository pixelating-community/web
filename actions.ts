"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import sharp from "sharp";
import { PutObjectCommand, PutObjectCommandInput } from "@aws-sdk/client-s3";
import { sql } from "@/lib/db";
import { img } from "@/lib/img";
import { decrypt, encrypt } from "@/lib/cryto";
import { s3Client } from "@/lib/s3";
import { z } from "zod";

export async function addPerspective(topicId: string, formData: FormData) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      perspective: z.string().min(1),
      topicId: z.string().min(1),
      color: z.string().min(1),
      description: z.string().nullish(),
    });
    const data = schema.parse({
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      topicId,
      color: formData.get("color"),
      description: formData.get("description"),
    });
    const isLock = await isLocked(data.topicId);
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
        const fileBuffer = await file.arrayBuffer();
        const { sharpBuffer, width, height, format } = await img({
          fileBuffer,
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

export async function editPerspective(
  topicId: string,
  id: string,
  objective_key: string,
  formData: FormData
) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      id: z.string().min(1),
      objective_key: z.string().min(1).nullable(),
      perspective: z.string().min(1),
      topicId: z.string().min(1),
      color: z.string(),
      description: z.string().nullable(),
    });
    const data = schema.parse({
      topicId,
      id,
      objective_key,
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      color: formData.get("color"),
      description: formData.get("description"),
    });
    let result = [];
    const isLock = await isLocked(data.topicId);
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
        const { sharpBuffer, width, height, format } = await img({
          fileBuffer,
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

export async function setCookie(
  token: string,
  topicId: string,
  perspectiveId?: string
) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      topicId: z.string().min(1),
      perspectiveId: z.string().nullish(),
    });
    const data = schema.parse({
      token,
      topicId,
      perspectiveId,
    });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE topic_id = ${data.topicId};
    `;
    if (isValid.length > 0 && isValid[0]["?column?"] === true) {
      if (perspectiveId) {
        cookies().set({
          name: `t_${data.topicId}`,
          value: `${data.token}`,
          httpOnly: true,
          path: `/p/${data.perspectiveId}/e`,
          secure: true,
          sameSite: "strict",
        });
      } else {
        cookies().set({
          name: `t_${data.topicId}`,
          value: `${data.token}`,
          httpOnly: true,
          path: `/t/${data.topicId}/w`,
          secure: true,
          sameSite: "strict",
        });
      }
    }
    return { message: "Incorrect token" };
  } catch (e) {
    console.log(e);
    return { message: "Failed to set cookie" };
  }
}

export async function createToken(
  topicId: string,
  token: string,
  tokenKey: string,
  lock: boolean
) {
  try {
    const tokenKeys = [
      process.env.TS_KEY,
      process.env.EL_KEY,
      process.env.KR_KEY,
      process.env.KL_KEY,
    ];
    const schema = z.object({
      topic_id: z.string().min(1),
      token: z.string().min(1),
      token_key: z.string().min(1),
      lock: z.boolean(),
    });
    const data = schema.parse({
      topic_id: topicId,
      token,
      token_key: tokenKey,
      lock,
    });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE topic_id = ${data.topic_id};
    `;
    if (isValid.length === 0 && tokenKeys.includes(data.token_key)) {
      await sql`
      INSERT INTO topics (topic_id, token, lock)
      VALUES (${data.topic_id}, crypt(${data.token}, gen_salt('bf')), ${lock});`;

      return { message: "TOKEN CREATED" };
    }
    return { message: "TOKEN EXISTS ALREADY" };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create token" };
  }
}

export async function getPerspective(id: string) {
  try {
    const schema = z.object({
      id: z.string().min(1),
    });
    const data = schema.parse({
      id,
    });

    return await sql`SELECT p.id, perspective, p.topic_id, color, p.objective_key, o.description, width, height FROM perspectives as p LEFT JOIN objectives as o ON p.objective_key = o.objective_key WHERE p.id=${data.id};`;
  } catch (e) {
    console.log(e, { message: "Failed to get perspective" });
  }
}

export async function isLocked(topicId: string) {
  try {
    const schema = z.object({
      topic_id: z.string().min(1),
    });
    const data = schema.parse({
      topic_id: topicId,
    });

    const [isLocked] =
      await sql`SELECT lock FROM topics WHERE topic_id=${data.topic_id}`.values();
    if (isLocked) {
      return !!isLocked[0];
    }

    return true;
  } catch (e) {
    console.log(e, { message: "Failed to get lock status, or DNE" });
  }
}

export async function getPerspectives({
  topicId,
  isLocked,
  token,
  forward,
}: {
  topicId: string;
  isLocked?: boolean;
  token?: string;
  forward?: boolean;
}) {
  try {
    const schema = z.object({
      topic_id: z.string().min(1),
      is_locked: z.boolean().nullish(),
      token: z.string().min(1).nullish(),
      forward: z.boolean().nullish(),
    });
    const data = schema.parse({
      topic_id: topicId,
      is_locked: isLocked,
      token: token,
      forward: forward,
    });
    const direction = forward ? sql`` : sql`DESC`;
    if (data.is_locked && data.token) {
      const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE topic_id = ${data.topic_id};
    `;
      if (isValid.length > 0 && isValid[0]["?column?"] === true) {
        const perspectives =
          await sql`SELECT p.id, perspective, p.topic_id, color, p.objective_key, o.description, width, height FROM perspectives as p LEFT JOIN objectives as o ON p.objective_key = o.objective_key WHERE p.topic_id=${data.topic_id} ORDER BY p.created_at ${direction};`.values();

        return perspectives.map((perspective) => {
          return {
            id: perspective[0],
            perspective: decrypt(perspective[1], data.token),
            color: perspective[3],
            objective_key: perspective[4],
            description: perspective[5],
            width: perspective[6],
            height: perspective[7],
          };
        });
      }

      return;
    }

    return await sql`SELECT p.id, perspective, p.topic_id, color, p.objective_key, o.description, width, height FROM perspectives as p LEFT JOIN objectives as o ON p.objective_key = o.objective_key WHERE p.topic_id=${data.topic_id} ORDER BY p.created_at ${direction};`;
  } catch (e) {
    console.log(e, { message: "Failed to get perspectives" });
  }
}

export async function deleteTopic(topicId: string, tokenKey: string) {
  const tokenKeys = [process.env.TS_KEY, process.env.EL_KEY];
  try {
    const schema = z.object({
      topic_id: z.string().min(1),
      token_key: z.string().min(1),
    });
    const data = schema.parse({
      topic_id: topicId,
      token_key: tokenKey,
    });
    if (tokenKeys.includes(data.token_key)) {
      await sql`DELETE FROM perspectives WHERE topic_id=${data.topic_id};`;
      await sql`DELETE FROM objectives WHERE topic_id=${data.topic_id};`;
      await sql`DELETE FROM topics WHERE topic_id=${data.topic_id};`;
      cookies().set(`t_${data.topic_id}`, "", { maxAge: 0 });
      cookies().delete(`t_${data.topic_id}`);
    }
  } catch (e) {
    console.log(e, { message: "Failed to delete topic" });
  }
}
