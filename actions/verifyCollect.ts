"use server";

import { z } from "zod/v4";
import { sql } from "@/lib/db";

export async function verifyCollect({
  chargeId,
  perspectiveId,
  sessionId,
}: {
  chargeId: string;
  perspectiveId: string;
  sessionId?: string;
}) {
  const schema = z.object({
    chargeId: z.string().regex(/^ch_[a-zA-Z0-9]+$/),
    perspectiveId: z.uuid(),
    sessionId: z.string().optional(),
  });
  const data = schema.parse({ chargeId, perspectiveId, sessionId });

  const rows = await sql`
    SELECT status
    FROM collected c
    JOIN perspectives p ON p.collection_id = c.collection_id
    WHERE c.stripe_charge_id = ${data.chargeId}
      AND p.id = ${data.perspectiveId}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return { verified: false, error: "no charge" };
  }

  if (rows[0].status === "succeeded") {
    return { verified: true, sessionId: data.sessionId };
  }

  return { verified: false, error: "charge not valid" };
}
