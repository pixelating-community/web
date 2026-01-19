"use server";

import { z } from "zod";
import { sql } from "@/lib/db";

export const addEdit = async ({
  name,
  sampleId,
}: {
  name: string;
  sampleId: string;
}) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      sampleId: z.uuid(),
    });
    const data = schema.parse({ name, sampleId });

    const result = await sql`
      INSERT INTO edits (name, sample_id, symbols)
      VALUES (${data.name}, ${data.sampleId}, '[]'::jsonb)
      RETURNING *
    `;

    return result[0];
  } catch (err) {
    console.error("Failed to add edit:", err);
    throw new Error("Failed to add edit");
  }
};
