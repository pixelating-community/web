"use server";

import { cookies } from "next/headers";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import {
  getReflectionWriteCookieName,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { broadcastSse } from "@/lib/sse";

export const editReflection = async ({
  id,
  text,
}: {
  id: string;
  text: string;
}) => {
  try {
    const schema = z.object({
      id: z.uuid(),
      text: z.string().min(1).max(5000),
    });

    const data = schema.parse({ id, text });

    const reflectionRows = await sql`
      SELECT perspective_id
      FROM reflections
      WHERE id = ${data.id}
      LIMIT 1;
    `;

    if (reflectionRows.length === 0) {
      throw new Error("reflection not found");
    }

    const perspectiveId = reflectionRows[0].perspective_id as string;
    const cookieStore = await cookies();
    const token = cookieStore.get(
      getReflectionWriteCookieName(perspectiveId),
    )?.value;
    const chargeId = verifyReflectionWriteToken(token, perspectiveId);
    if (!chargeId) {
      throw new Error("write token not valid");
    }

    const collected = await sql`
      SELECT c.status
      FROM reflections r
      JOIN perspectives p ON p.id = r.perspective_id
      JOIN collected c ON c.collection_id = p.collection_id
      WHERE r.id = ${data.id}
        AND c.stripe_charge_id = ${chargeId}
      LIMIT 1;
    `;

    if (collected.length === 0 || collected[0].status !== "succeeded") {
      throw new Error("charge not valid");
    }

    const result = await sql`
      UPDATE reflections
      SET text = ${data.text}, updated_at = NOW()
      WHERE id = ${data.id}
      RETURNING id, perspective_id, reflection_id, text, updated_at, created_at
    `;

    if (result.length === 0) {
      throw new Error(`Reflection edit failed: ${data.id}`);
    }
    try {
      broadcastSse(result[0].perspective_id as string, {
        type: "edit",
        id: data.id,
        text: data.text,
      });
    } catch {
      // best-effort broadcast
    }
    return result[0];
  } catch (error) {
    console.log(`${error}`);
  }
};
