import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";


export const deletePerspective = async ({
  perspectiveId,
}: {
  perspectiveId: string;
}) => {
  const schema = z.object({
    perspectiveId: z.uuid(),
  });
  const data = schema.parse({
    perspectiveId,
  });

  const contributionRows = await sql`
    WITH RECURSIVE perspective_tree AS (
      SELECT id FROM perspectives WHERE id = ${data.perspectiveId}
      UNION
      SELECT child.id
      FROM perspectives AS child
      JOIN perspective_tree AS parent ON child.parent_perspective_id = parent.id
    )
    SELECT 1
    FROM perspective_contributions AS contribution
    JOIN perspective_tree ON perspective_tree.id = contribution.perspective_id
    LIMIT 1;
  `;
  if (contributionRows.length > 0) {
    return { deleted: false as const, reason: "payment-history" as const };
  }

  await sql`DELETE FROM perspectives WHERE id=${data.perspectiveId};`;
  return { deleted: true as const };
};
