"use server";

import type { UUID } from "node:crypto";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const getEditById = async ({
  id,
}: {
  id: UUID;
}): Promise<{
  id: UUID;
  name: string;
  src: string;
  track_id: UUID;
  track_name: string;
} | null> => {
  try {
    const schema = z.object({
      id: z.uuid().min(1),
    });
    const data = schema.parse({
      id,
    });

    const edit = await sql`
      SELECT id, track_id, name
      FROM edits
      WHERE id = ${data.id}
    `;

    const track = await sql`
      SELECT id, src, name
      FROM tracks
      WHERE id = ${edit[0]?.track_id}
    `;
    return edit.length > 0 && track.length > 0
      ? {
          id: edit[0].id,
          name: edit[0].name,
          src: track[0].src,
          track_id: edit[0].track_id,
          track_name: track[0].name,
        }
      : null;
  } catch (e) {
    console.log(e, { message: "Failed to get edit" });
  }
};
