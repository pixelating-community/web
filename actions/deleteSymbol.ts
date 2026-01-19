"use server";

import type { UUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const deleteSymbol = async ({
  perspectiveId,
  symbolId,
}: {
  perspectiveId: UUID;
  symbolId: UUID;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
      symbolId: z.uuid(),
    });

    schema.parse({ perspectiveId, symbolId });

    await sql`
      UPDATE perspectives
      SET symbols = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(symbols, '[]'::jsonb)) elem
        WHERE elem->>'id' != ${symbolId}
      ),
      updated_at = NOW()
      WHERE id = ${perspectiveId};
    `;

    revalidatePath(`/p/${perspectiveId}`);
    return { success: true };
  } catch (e) {
    console.error(e);
    return { error: "Failed to delete symbol" };
  }
};
