"use server";

import { z } from "zod";

export const getPerspective = async ({ id }: { id: string }) => {
  try {
    const schema = z.object({
      id: z.uuid(),
    });
    const data = schema.parse({ id });
    const { sql } = await import("@/lib/db");
    const result = await sql`
      SELECT *
      FROM perspectives
      WHERE id = ${data.id}
    `;

    if (result.length === 0) {
      return null;
    }

    return result;
  } catch (err) {
    console.error("Failed to fetch perspective:", err);
    return null;
  }
};
