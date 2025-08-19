"use server";

import { z } from "zod";

const PerspectiveSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const getPerspective = async (id: string) => {
  if (!id) return null;

  try {
    const { sql } = await import("@/lib/db");
    const [result] = await sql`SELECT * FROM perspectives WHERE id = ${id}`;
    return result ? PerspectiveSchema.parse(result) : null;
  } catch (err) {
    console.error("Failed to fetch perspective:", err);
    return null;
  }
};
