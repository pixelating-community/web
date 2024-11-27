"use server";

import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { z } from "zod/v4";

export async function deleteLyric({
  lyricId,
  trackId,
  editId,
}: {
  lyricId: string;
  trackId: string;
  editId: string;
}) {
  try {
    const schema = z.object({
      lyricId: z.string().min(1),
      trackId: z.string().min(1),
      editId: z.string().min(1),
    });
    const data = schema.parse({
      lyricId,
      trackId,
      editId,
    });

    await sql`DELETE FROM lyrics WHERE id=${data.lyricId};`;
    revalidatePath("/");
  } catch (e) {
    console.log(e, { message: "Failed to delete lyric" });
  }
}
