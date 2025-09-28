"use server";

import type { UUID } from "node:crypto";
import { z } from "zod";

export const getPerspective = async (id: UUID) => {
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
      throw new Error(`Topic not found: ${data.id}`);
    }

    return result;
  } catch (err) {
    console.error("Failed to fetch perspective:", err);
    return null;
  }
};
