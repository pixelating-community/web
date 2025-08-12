"use server";

import { sql } from "@/lib/db";
import { UUID } from "crypto";
import { z } from "zod/v4";

export async function getEditByName({ name }: { name: string }): Promise<{
  src: string | null;
  id: UUID;
  name: string;
  track_id: UUID;
} | null> {
  try {
    const schema = z.object({
      name: z.string().min(1),
    });
    const data = schema.parse({ name });
    const edit = await sql`
      SELECT id, name, track_id
      FROM edits
      WHERE name = ${data.name}
    `;

    if (edit.length === 0 || !edit[0].track_id) {
      return null;
    }

    const track = await sql`
      SELECT id, src, name
      FROM tracks
      WHERE id = ${edit[0].track_id}
    `;

    if (track.length === 0) {
      return {
        id: edit[0].id,
        name: edit[0].name,
        track_id: edit[0].track_id,
        src: null,
      };
    }

    return {
      id: edit[0].id,
      name: edit[0].name,
      track_id: edit[0].track_id,
      src: track[0].src,
    };
  } catch (e) {
    console.error(e, { message: "Failed to get edit by name" });
    return null;
  }
}
