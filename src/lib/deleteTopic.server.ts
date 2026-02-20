import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";

export const deleteTopic = async ({
  topicId,
}: {
  topicId: string;
}) => {
  const data = z.object({ topicId: z.uuid() }).parse({ topicId });
  await sql`DELETE FROM topics WHERE id = ${data.topicId}`;
};
