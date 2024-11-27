"use server";

import { sql } from "@/lib/db";
import { parseSampleUrl } from "@/lib/parseSampleUrl";

export const addSample = async ({ url }: { url: string }) => {
  const { editName, start, end } = parseSampleUrl(url);

  if (editName && start && end) {
    const result = await sql`
      SELECT id FROM edits WHERE name = ${editName};
    `;

    if (result.length === 0) {
      throw new Error("edit not found");
    }

    const id = result[0].id;
    const insertResult = await sql`
        INSERT INTO samples (edit_id, start_at, end_at)
        VALUES (${id}, ${start}, ${end})
        RETURNING id;
      `;
    return insertResult;
  }
};
