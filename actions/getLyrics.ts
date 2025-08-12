"use server";

import { sql } from "@/lib/db";
import { formatTime } from "@/lib/formatTime";
import { UUID } from "crypto";
import { z } from "zod/v4";

export async function getLyrics({ editId }: { editId: UUID }) {
  try {
    const schema = z.object({
      edit_id: z.uuid().nullish(),
    });
    const data = schema.parse({
      edit_id: editId,
    });

    const lyrics = await sql`
        SELECT
          lyrics.id,
          lyrics.lyric,
          lyrics.style,
          lyrics.start_at,
          lyrics.end_at,
          edits.id AS edit_id,
          edits.name AS edit_name,
          objectives.src AS src
        FROM lyrics
        JOIN edits ON lyrics.edit_id = edits.id
        LEFT JOIN objectives ON lyrics.objective_id = objectives.id
        WHERE edit_id = ${data.edit_id}
        ORDER BY lyrics.start_at;
      `;

    return (
      lyrics.map((lyric) => ({
        id: lyric.id,
        src: lyric.src,
        lyric: lyric.lyric,
        timestamp: formatTime(lyric.start_at),
        ...(lyric.style && { style: lyric.style }),
      })) || []
    );
  } catch (e) {
    console.error(e, { message: "Failed to get lyrics" });
  }
}
