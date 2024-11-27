"use server";

import { sql } from "@/lib/db";
import { formatTime } from "@/lib/formatTime";
import { z } from "zod";

export async function getLyrics({
  trackId,
  editId,
}: {
  trackId: string;
  editId?: string;
}) {
  try {
    const schema = z.object({
      track_id: z.string().min(1),
      edit_id: z.string().min(1),
    });
    const data = schema.parse({
      track_id: trackId,
      edit_id: editId,
    });

    const lyrics = await sql`
      SELECT id, lyric, start_at, style, media_id
      FROM lyrics
      WHERE track_id = ${data.track_id}
      AND edit_id = ${data.edit_id}
      ORDER BY start_at;
    `;

    const mediaIds = lyrics.map((lyric) => lyric.media_id).filter((id) => id);

    const mediaUrls = await sql`
      SELECT id, url
      FROM media
      WHERE id = ANY(${mediaIds});
    `;

    const mediaUrlMap = Object.fromEntries(
      mediaUrls.map((media) => [media.id, media.url])
    );

    const updatedLyrics = lyrics.map((lyric) => ({
      ...lyric,
      id: lyric.id,
      lyric: lyric.lyric,
      style: lyric.style,
      start_at: lyric.start_at,
      media_id: lyric.media_id,
      media_url: mediaUrlMap[lyric.media_id],
    }));

    return updatedLyrics.map(({ id, start_at, lyric, style, media_url }) => ({
      id,
      timestamp: formatTime(start_at),
      text: lyric,
      ...(style && { style }),
      ...(media_url && { url: media_url }),
    }));
  } catch (e) {
    console.log(e, { message: "Failed to get lyrics" });
  }
}
