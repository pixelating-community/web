"use server";

import { decrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";
import { z } from "zod/v4";

export async function getPerspectives({
  topicId,
  isLocked,
  token,
  forward,
}: {
  topicId: string;
  isLocked?: boolean;
  token?: string;
  forward?: boolean;
}) {
  try {
    const schema = z.object({
      topic_id: z.string().min(1),
      is_locked: z.boolean().nullish(),
      token: z.string().min(1).nullish(),
      forward: z.boolean().nullish(),
    });
    const data = schema.parse({
      topic_id: topicId,
      is_locked: isLocked,
      token: token,
      forward: forward,
    });
    const direction = forward ? sql`` : sql`DESC`;
    let isValid = [{ "?column?": false }];

    if (data.is_locked && data.token) {
      isValid = await sql`
        SELECT token = crypt(${data.token}, token) FROM topics WHERE id = ${data.topic_id};
      `;
    }

    const perspectives =
      await sql`SELECT p.id, perspective, p.topic_id, color, p.objective_id, o.description, width, height, s.id, e.id, t.id, t.src, s.start_at, s.end_at FROM perspectives as p
        LEFT JOIN objectives as o ON p.objective_id = o.id
        LEFT JOIN samples as s ON p.sample_id = s.id
        LEFT JOIN edits as e ON s.edit_id = e.id
        LEFT JOIN tracks as t ON e.track_id = t.id
        LEFT JOIN lyrics as l ON e.id = l.edit_id
        WHERE p.topic_id=${data.topic_id}
        ORDER BY p.created_at ${direction};`.values();

    const seenIds = new Set();
    const dedupedPerspectives = perspectives.filter((row) => {
      const id = row[0];
      if (seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    const perspectivesWithLyrics = await Promise.all(
      dedupedPerspectives.map(async (perspective) => {
        const editId = perspective[9];
        let lyrics: { lyric: any; timestamp: any }[] = [];
        if (editId) {
          const lyricRows =
            await sql`SELECT id, lyric, start_at AS timestamp, style FROM lyrics WHERE edit_id = ${editId};`.values();
          lyrics = lyricRows.map(([id, lyric, timestamp, style]) => ({
            id,
            lyric,
            timestamp,
            style,
          }));
        }

        return {
          id: perspective[0],
          perspective:
            isValid.length > 0 &&
            isValid[0]["?column?"] === true &&
            data.is_locked
              ? decrypt(perspective[1], data.token)
              : perspective[1],
          topic_id: perspective[2],
          color: perspective[3],
          objective_id: perspective[4],
          description: perspective[5],
          width: perspective[6],
          height: perspective[7],
          sample_id: perspective[8] ? perspective[8] : null,
          edit_id: perspective[9],
          track_id: perspective[10],
          track_src: perspective[11],
          lyrics: [lyrics],
          start: perspective[12],
          end: perspective[13],
        };
      })
    );

    return perspectivesWithLyrics;
  } catch (e) {
    console.log(e, { message: "Failed to get perspectives" });
  }
}
