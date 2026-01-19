"use server";

import type { UUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import type { Cue } from "@/types/symbol";

export const addSymbols = async ({
  perspectiveId,
  symbols,
}: {
  perspectiveId: UUID;
  symbols: Cue[];
}) => {
  if (symbols.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
    });

    schema.parse({ perspectiveId });

    const symbolsWithIds = symbols.map((s) => ({
      ...s,
      id: s.id || crypto.randomUUID(),
    }));

    await sql`
      UPDATE perspectives
      SET symbols = COALESCE(symbols, '[]'::jsonb) || ${JSON.stringify(symbolsWithIds)}::jsonb,
          updated_at = NOW()
      WHERE id = ${perspectiveId};
    `;

    revalidatePath(`/p/${perspectiveId}`);
    return { success: true, count: symbolsWithIds.length };
  } catch (e) {
    console.error(e);
    return { error: "Failed to add symbols" };
  }
};
