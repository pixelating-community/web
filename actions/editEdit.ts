"use server";

import { z } from "zod";
import { sql } from "@/lib/db";
import type { Cue } from "@/types/symbol";

export const editEdit = async ({
  id,
  symbols,
}: {
  id: string;
  symbols: Cue[];
}) => {
  try {
    const schema = z.object({
      id: z.uuid(),
      symbols: z.array(z.any()),
    });
    const data = schema.parse({ id, symbols });

    const current = await sql`
      SELECT symbols FROM edits WHERE id = ${data.id}
    `;

    let existingSymbols: Cue[] = [];
    if (current.length > 0 && current[0].symbols) {
      existingSymbols = current[0].symbols as Cue[];
    }

    const newSymbols = [...existingSymbols, ...data.symbols];

    await sql`
      UPDATE edits
      SET symbols = ${sql.json(newSymbols)},
          updated_at = NOW()
      WHERE id = ${data.id}
    `;

    return { success: true };
  } catch (err) {
    console.error("Failed to edit edit:", err);
    throw new Error("Failed to edit edit");
  }
};
