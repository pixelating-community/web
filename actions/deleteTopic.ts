"use server";

import { cookies } from "next/headers";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const deleteTopic = async (topicId: string, tokenKey: string) => {
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
      await sql`DELETE FROM topics WHERE id=${data.topic_id};`;
      cookieStore.set(`t_${data.topic_id}`, "", { maxAge: 0 });
      cookieStore.delete(`t_${data.topic_id}`);
    }
  } catch (e) {
    console.log(e, { message: "Failed to delete topic" });
  }
};
