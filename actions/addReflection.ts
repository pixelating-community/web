"use server";

import { cookies } from "next/headers";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import {
  getReflectionWriteCookieName,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { broadcastSse } from "@/lib/sse";

export const addReflection = async ({
  perspectiveId,
  reflectionId,
  text,
}: {
  perspectiveId: string;
  reflectionId?: string;
  text: string;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
      reflectionId: z.uuid().nullish(),
      text: z.string().min(1).max(5000),
    });

    const data = schema.parse({ perspectiveId, reflectionId, text });

    const cookieStore = await cookies();
    const token = cookieStore.get(
      getReflectionWriteCookieName(data.perspectiveId),
    )?.value;
    const chargeId = verifyReflectionWriteToken(token, data.perspectiveId);
    if (!chargeId) {
      throw new Error("write token not valid");
    }

    const result = await sql`
      WITH consumed_charge AS (
        UPDATE collected c
        SET stripe_charge_id = gen_random_uuid()::text
        FROM perspectives p
        WHERE p.id = ${data.perspectiveId}
          AND p.collection_id = c.collection_id
          AND c.stripe_charge_id = ${chargeId}
          AND c.status = 'succeeded'
        RETURNING c.id
      )
      INSERT INTO reflections (perspective_id, reflection_id, text)
      SELECT ${data.perspectiveId}, ${data.reflectionId}, ${data.text}
      WHERE EXISTS (SELECT 1 FROM consumed_charge)
      RETURNING id, perspective_id, reflection_id, text, updated_at, created_at;
    `;

    if (result.length === 0) {
      throw new Error("charge not valid");
    }
    try {
      cookieStore.delete(getReflectionWriteCookieName(data.perspectiveId));
    } catch {
      // ignore cookie delete failures
    }
    try {
      broadcastSse(data.perspectiveId, result[0]);
    } catch {
      // best-effort broadcast
    }
    return result[0];
  } catch (error) {
    console.log(`${error}`);
  }
};
