import "@tanstack/react-start/server-only";
import { sql } from "@/lib/db.server";

export const getChapter = async (topicName: string) => {
  const rows = await sql`
    SELECT chapters.id, chapters.topic_id
    FROM chapters
    JOIN topics ON topics.id = chapters.topic_id
    WHERE topics.name = ${topicName}
    LIMIT 1;
  `;
  return rows[0] ?? null;
};
