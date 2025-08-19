"use server";

import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const getSampleLyrics = async ({ id }: { id: string }) => {
  try {
    const schema = z.object({
      id: z.string().min(1),
    });
    const data = schema.parse({
      id,
    });

    const result = await sql`
      SELECT
      samples.id AS sample_id,
      samples.start_at AS sample_start_at,
      samples.end_at AS sample_end_at,
      edits.name AS edit_name,
      tracks.name AS track_name
      FROM samples
      LEFT JOIN edits ON samples.edit_id = edits.id
      LEFT JOIN tracks ON edits.track_id = tracks.id
      WHERE samples.id = ${data.id}
    `;
    if (!result[0]) return null;
    return {
      id: result[0].sample_id,
      trackName: result[0].track_name,
      editName: result[0].edit_name,
      start: result[0].sample_start_at,
      end: result[0].sample_end_at,
    };
  } catch (e) {
    console.log(e, { message: "Failed to get lyrics" });
  }
};
