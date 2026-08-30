import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";

export const deleteTopic = async ({
  topicId,
}: {
  topicId: string;
}) => {
  const data = z.object({ topicId: z.uuid() }).parse({ topicId });
  const contributionRows = await sql`
    SELECT 1
    FROM perspective_contributions AS contribution
    JOIN perspectives AS perspective
      ON perspective.id = contribution.perspective_id
    WHERE perspective.topic_id = ${data.topicId}
    LIMIT 1;
  `;
  if (contributionRows.length > 0) {
    return { deleted: false as const, reason: "payment-history" as const };
  }
  await sql`DELETE FROM topics WHERE id = ${data.topicId}`;
  return { deleted: true as const };
};
