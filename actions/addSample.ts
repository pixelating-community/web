"use server";

import { sql } from "@/lib/db";
import { parseSampleUrl } from "@/lib/parseSampleUrl";

export const addSample = async ({ url }: { url: string }) => {
  const { trackName, editName, start, end } = parseSampleUrl(url);

  if (trackName && editName && start && end) {
    const result = await sql`
      SELECT edits.id
      FROM edits
      JOIN tracks ON edits.track_id = tracks.id
      WHERE edits.name = ${editName} AND tracks.name = ${trackName};
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
