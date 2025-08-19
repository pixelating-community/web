"use server";

import type { UUID } from "node:crypto";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const getTrackById = async ({ trackId }: { trackId: UUID }) => {
  try {
    const schema = z.object({
      track_id: z.string().min(1),
    });
    const data = schema.parse({
      track_id: trackId,
    });

    const track = await sql`
      SELECT audio_src, track_id
      FROM tracks
      WHERE track_id = ${data.track_id}
    `;

    return track.length > 0 ? track[0] : null;
  } catch (e) {
    console.log(e, { message: "Failed to get track" });
  }
};
