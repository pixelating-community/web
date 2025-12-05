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
  elKey,
}: {
  perspectiveId: string;
  reflectionId?: string;
  text: string;
  elKey?: string;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
      reflectionId: z.uuid().nullish(),
      text: z.string().min(1).max(5000),
      elKey: z.string().optional(),
    });

    const data = schema.parse({ perspectiveId, reflectionId, text, elKey });
    const isElevated = data.elKey && data.elKey === process.env.EL_KEY;
    const parentId = data.reflectionId ?? null;

    // biome-ignore lint/suspicious/noExplicitAny: sql returns dynamic rows
    let result: any[] = [];
    if (isElevated) {
      result = await sql`
        INSERT INTO reflections (perspective_id, reflection_id, text)
        VALUES (${data.perspectiveId}, ${parentId}, ${data.text})
        RETURNING id, perspective_id, reflection_id, text, updated_at, created_at;
      `;
    } else {
      const cookieStore = await cookies();
      const token = cookieStore.get(
        getReflectionWriteCookieName(data.perspectiveId),
      )?.value;
      const chargeId = verifyReflectionWriteToken(token, data.perspectiveId);
      if (!chargeId) {
        throw new Error("write token not valid");
      }
      result = await sql`
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
        SELECT ${data.perspectiveId}, ${parentId}, ${data.text}
        WHERE EXISTS (SELECT 1 FROM consumed_charge)
        RETURNING id, perspective_id, reflection_id, text, updated_at, created_at;
      `;
    }

    if (result.length === 0) {
      throw new Error(
        isElevated ? "reflection insertion failed" : "charge not valid",
      );
    }
    if (!isElevated) {
      try {
        const cookieStore = await cookies();
        cookieStore.delete(getReflectionWriteCookieName(data.perspectiveId));
      } catch {
        // ignore cookie delete failures
      }
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
