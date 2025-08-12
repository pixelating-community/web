"use server";

import { sql } from "@/lib/db";
import { z } from "zod/v4";

export async function getPerspective(id: string) {
  try {
    const schema = z.object({
      id: z.string().min(1),
    });
    const data = schema.parse({
      id,
    });

    return await sql`SELECT p.id, perspective, p.topic_id, color, p.objective_key, o.description, width, height FROM perspectives as p LEFT JOIN objectives as o ON p.objective_key = o.objective_key WHERE p.id=${data.id};`;
  } catch (e) {
    console.log(e, { message: "Failed to get perspective" });
  }
}
