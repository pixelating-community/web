"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { z } from "zod";

export async function addLyric({
  trackId,
  formData,
}: {
  trackId: string;
  formData: FormData;
}) {
  try {
    const schema = z.object({
      lyric: z.string().min(1),
      trackId: z.string().min(1),
      editId: z.string().min(1),
      startAt: z.string().min(1),
      style: z.string().nullish(),
      url: z.string().nullish(),
      description: z.string().nullish(),
      width: z.string().nullish(),
      height: z.string().nullish(),
    });
    const data = schema.parse({
      lyric: formData.get("lyric"),
      trackId,
      editId: formData.get("edit_id"),
      startAt: formData.get("start_at"),
      style: formData.get("style"),
      url: formData.get("url"),
      description: formData.get("description"),
      width: formData.get("width"),
      height: formData.get("height"),
    });

    let result = [];
    if (data.url) {
      const media = await sql`
      INSERT INTO media (url,  track_id, edit_id, description, width, height)
      VALUES (${data.url}, ${data.trackId}, ${data.editId}, ${data.description}, ${data.width}, ${data.height});
      `;

      if (media) {
        const mediaId = media[0].id;
        result = await sql`
          INSERT INTO lyrics (lyric, track_id, edit_id, start_at, style, media_id)
          VALUES (${data.lyric}, ${data.trackId}, ${data.editId}, ${data.startAt}, ${data.style}, ${mediaId});
          `;
      }
    } else {
      result = await sql`
          INSERT INTO lyrics (lyric, track_id, edit_id, start_at, style)
          VALUES (${data.lyric}, ${data.trackId}, ${data.editId}, ${data.startAt}, ${data.style});
          `;
    }

    revalidatePath("/");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create lyric" };
  }
}
