"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { validateStyle } from "@/lib/validateStyle";
import { z } from "zod";

export async function editLyric({
  lyricId,
  trackId,
  formData,
}: {
  lyricId: string;
  trackId: string;
  formData: FormData;
}) {
  try {
    const schema = z.object({
      lyricId: z.string().min(1),
      trackId: z.string().min(1),
      lyric: z.string().min(1),
      editId: z.string().min(1),
      startAt: z.string().min(1),
      style: z.string().nullish(),
      url: z.string().nullish(),
      description: z.string().nullish(),
      width: z.string().nullish(),
      height: z.string().nullish(),
    });
    const data = schema.parse({
      lyricId,
      trackId,
      lyric: formData.get("lyric"),
      editId: formData.get("edit_id"),
      startAt: formData.get("start_at"),
      style: validateStyle(formData.get("style") as string),
      url: formData.get("url"),
      description: formData.get("description"),
      width: formData.get("width"),
      height: formData.get("height"),
    });

    let result = [];
    if (data.url || data.description || data.width || data.height) {
      const media = await sql`
      UPDATE media SET
      url = ${data.url},
      description = ${data.description},
      width = ${data.width},
      height = ${data.height}
      WHERE lyric_id = ${data.lyricId}
      RETURNING id;
      `;
      let mediaId = media[0]?.id;
      if (!mediaId) {
        const newMedia = await sql`
      INSERT INTO media (lyric_id, url, description, width, height)
      VALUES (${data.lyricId}, ${data.url}, ${data.description}, ${data.width}, ${data.height})
      RETURNING id;
      `;
        mediaId = newMedia[0]?.id;
      }

      if (mediaId) {
        result = await sql`
      UPDATE lyrics SET lyric = ${data.lyric}, start_at = ${data.startAt}, style = ${data.style} , media_id = ${mediaId} WHERE id = ${data.lyricId};
      `;
      }
    } else {
      result = await sql`
        UPDATE lyrics SET lyric = ${data.lyric}, start_at = ${data.startAt}, style = ${data.style}
        WHERE id = ${data.lyricId};
        `;
    }
    revalidatePath(`/k/${data.trackId}/${data.editId}/s`, "page");
    return result;
  } catch (e) {
    console.log(e, { message: "Failed to edit lyric" });
  }
}
