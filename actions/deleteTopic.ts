"use server";

import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { z } from "zod";

export async function deleteTopic(topicId: string, tokenKey: string) {
  const tokenKeys = [process.env.TS_KEY, process.env.EL_KEY];
  try {
    const schema = z.object({
      topic_id: z.string().min(1),
      token_key: z.string().min(1),
    });
    const data = schema.parse({
      topic_id: topicId,
      token_key: tokenKey,
    });
    if (tokenKeys.includes(data.token_key)) {
      const cookieStore = await cookies();
      await sql`DELETE FROM perspectives WHERE topic_id=${data.topic_id};`;
      await sql`DELETE FROM objectives WHERE topic_id=${data.topic_id};`;
      await sql`DELETE FROM topics WHERE topic_id=${data.topic_id};`;
      cookieStore.set(`t_${data.topic_id}`, "", { maxAge: 0 });
      cookieStore.delete(`t_${data.topic_id}`);
    }
  } catch (e) {
    console.log(e, { message: "Failed to delete topic" });
  }
}
