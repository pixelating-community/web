"use server";

import type { UUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { getEditById } from "@/actions/getEditByID";
import { sql } from "@/lib/db";
import { validateStyle } from "@/lib/validateStyle";

export const editLyric = async ({
  editId,
  lyricId,
  formData,
}: {
  editId: UUID;
  lyricId: UUID;
  formData: FormData;
}) => {
  try {
    const schema = z.object({
      editId: z.uuid(),
      lyricId: z.uuid(),
      lyric: z.string().min(1),
      startAt: z.string().min(1),
      style: z.string().nullish(),
      url: z.string().nullish(),
      description: z.string().nullish(),
      width: z.string().nullish(),
      height: z.string().nullish(),
    });

    const data = schema.parse({
      editId,
      lyricId,
      lyric: formData.get("lyric"),
      startAt: formData.get("start_at"),
      style: validateStyle(formData.get("style") as string),
      url: formData.get("url"),
      description: formData.get("description"),
      width: formData.get("width"),
      height: formData.get("height"),
    });

    let result = [];

    const edit = await getEditById({ id: data.editId as UUID });

    if (data.url || data.description || data.width || data.height) {
      const updateObjective = await sql`
        UPDATE objectives SET
        url = ${data.url},
        description = ${data.description},
        width = ${data.width},
        height = ${data.height}
        WHERE lyric_id = ${data.lyricId}
        RETURNING id;
      `;

      let objective_id = updateObjective[0]?.id;

      if (!objective_id) {
        const insertObjective = await sql`
          INSERT INTO objectives (lyric_id, url, description, width, height)
          VALUES (${data.lyricId}, ${data.url}, ${data.description}, ${data.width}, ${data.height})
          RETURNING id;
        `;
        objective_id = insertObjective[0]?.id;
      }

      if (objective_id) {
        result = await sql`
          UPDATE lyrics SET lyric = ${data.lyric}, start_at = ${data.startAt}, style = ${data.style} , objective_id = ${objective_id} WHERE id = ${data.lyricId};
        `;
      }
    } else {
      result = await sql`
        UPDATE lyrics SET lyric = ${data.lyric}, start_at = ${data.startAt}, style = ${data.style}
        WHERE id = ${data.lyricId};
      `;
    }
    revalidatePath(`/k/${edit.track_id}/${data.editId}/s`, "page");
    return result;
  } catch (e) {
    console.log(e, { message: "Failed to edit lyric" });
  }
};
