"use server";

import { decrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { z } from "zod";

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
