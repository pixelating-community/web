import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";


export const deletePerspective = async ({
  perspectiveId,
}: {
  perspectiveId: string;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuid(),
    });
    const data = schema.parse({
      perspectiveId,
    });

    await sql`DELETE FROM perspectives WHERE id=${data.perspectiveId};`;

  } catch (e) {
    console.log(e, { message: "Failed to delete perspective" });
  }
};
