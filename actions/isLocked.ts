"use server";

import { sql } from "@/lib/db";
import { z } from "zod";

export async function isLocked({ topicId }: { topicId: string }) {
  try {
    const schema = z.object({
      topic_id: z.string().min(1),
    });
    const data = schema.parse({
      topic_id: topicId,
    });

    const [isLocked] =
      await sql`SELECT lock FROM topics WHERE topic_id=${data.topic_id}`.values();
    if (isLocked) {
      return !!isLocked[0];
    }

    return true;
  } catch (e) {
    console.log(e, { message: "Failed to get lock status, or DNE" });
  }
}
