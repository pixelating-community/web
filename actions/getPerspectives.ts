"use server";

import { z } from "zod/v4";
import { decrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";

export const getPerspectives = async ({
  topicId,
  isLocked,
  token,
  forward,
}: {
  topicId: string;
  isLocked?: boolean;
  token?: string;
  forward?: boolean;
}) => {
  try {
    const schema = z.object({
      topic_id: z.uuid(),
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
    let isValid = [{ "?column?": false }];

    if (data.is_locked && data.token) {
      isValid = await sql`
        SELECT token = crypt(${data.token}, token) FROM topics WHERE id = ${data.topic_id};
      `;
    }

    const perspectives =
      await sql`SELECT p.id, perspective, p.topic_id, p.collection_id, p.audio_src, p.start_time, p.end_time, p.symbols
        FROM perspectives as p
        WHERE p.topic_id=${data.topic_id}
        ORDER BY p.id ${direction};`;

    return perspectives.map((perspective) => ({
      id: perspective.id,
      perspective:
        isValid.length > 0 && isValid[0]["?column?"] === true && data.is_locked
          ? decrypt(perspective.perspective, data.token)
          : perspective.perspective,
      topic_id: perspective.topic_id,
      collection_id: perspective.collection_id,
      audio_src:
        !data.is_locked ||
        (isValid.length > 0 && isValid[0]["?column?"] === true)
          ? (perspective.audio_src ?? null)
          : null,
      start_time:
        !data.is_locked ||
        (isValid.length > 0 && isValid[0]["?column?"] === true)
          ? (perspective.start_time ?? null)
          : null,
      end_time:
        !data.is_locked ||
        (isValid.length > 0 && isValid[0]["?column?"] === true)
          ? (perspective.end_time ?? null)
          : null,
      symbols:
        !data.is_locked ||
        (isValid.length > 0 && isValid[0]["?column?"] === true)
          ? (perspective.symbols ?? [])
          : [],
    }));
  } catch (e) {
    console.log(e, { message: "Failed to get perspectives" });
  }
};
