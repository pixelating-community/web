"use server";

import type { UUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const addLyric = async ({
  editId,
  formData,
}: {
  editId: UUID;
  formData: FormData;
}) => {
  try {
    const schema = z.object({
      editId: z.uuid(),
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
      lyric: formData.get("lyric"),
      startAt: formData.get("start_at"),
      style: formData.get("style"),
      url: formData.get("url"),
      description: formData.get("description"),
      width: formData.get("width"),
      height: formData.get("height"),
    });

    let result = [];
    let objective_id: UUID;

    if (data.url) {
      objective_id = await sql`
          INSERT INTO objectives(src)
          VALUES (${data.url});
          RETURNING id;
      `[0].id;
      result = await sql`
          INSERT INTO lyrics (lyric, objective_id, edit_id, start_at, style)
          VALUES (${data.lyric}, ${objective_id}, ${data.editId}, ${data.startAt}, ${data.style});
          WHERE edit_id = ${data.editId}
          `;
    } else {
      result = await sql`
          INSERT INTO lyrics (lyric, edit_id, start_at, style)
          VALUES (${data.lyric}, ${data.editId}, ${data.startAt}, ${data.style});
          `;
    }

    revalidatePath("/");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create lyric" };
  }
};
