"use server";

import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const getPerspective = async (id: string) => {
  try {
    const schema = z.object({
      id: z.string().min(1),
    });
    const data = schema.parse({
      id,
    });

    return await sql`SELECT p.id, perspective, p.topic_id, color, p.objective_id, o.description, width, height FROM perspectives as p LEFT JOIN objectives as o ON p.objective_id = o.id WHERE p.id=${data.id};`;
  } catch (e) {
    console.log(e, { message: "Failed to get perspective" });
  }
};
