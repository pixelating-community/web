"use server";

import { sql } from "@/lib/db";
import { parseSampleUrl } from "@/lib/parseSampleUrl";

export const editSample = async ({ url }: { url: string }) => {
  const { editName, start, end } = parseSampleUrl(url);

  if (editName && start && end) {
    const editRow = await sql`
      SELECT id FROM edits WHERE name = ${editName};
    `;
    if (editRow.length === 0) {
      throw new Error("Track not found");
    }
    await sql`
      UPDATE sample
      SET edit_id = ${editRow[0].id}
      SET start_at = ${start}
      SET end_at = ${end}
      WHERE edit_id= ${editRow[0].id};
    `;
  }
};
