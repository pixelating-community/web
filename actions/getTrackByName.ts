"use server";

import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const getTrackByName = async ({ name }: { name: string }) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
    });
    const data = schema.parse({
      name,
    });
    const track = await sql`
      SELECT id, src
      FROM tracks
      WHERE name = ${data.name}
    `;

    return track.length > 0 ? track[0] : null;
  } catch (e) {
    console.log(e, { message: "Failed to get track" });
  }
};
