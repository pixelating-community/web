"use server";

import type { Url } from "node:url";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const addTrack = async ({
  name,
  src,
  key,
}: {
  name: string;
  src: Url;
  key: string;
}): Promise<{ name: string; src: Url } | { message: string }> => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      src: z.url().min(1),
      key: z.string().min(1),
    });
    const data = schema.parse({
      name,
      src,
      key,
    });
    const tokenKeys = [process.env.TS_KEY, process.env.EL_KEY];
    if (tokenKeys.includes(data.key)) {
      const track = await sql`INSERT INTO tracks(name, src) VALUES (
      ${data.name},
      ${data.src}
      )
      ON CONFLICT DO NOTHING
      returning name, src;
    `;

      return track.length
        ? { name: track[0].name as string, src: track[0].src as Url }
        : { name: "", src: "" as unknown as Url };
    } else {
      return { message: "noop" };
    }
  } catch (e) {
    console.log(e, { message: "Failed to add track" });
  }
};
