"use server";

import { z } from "zod";

export const getEdit = async ({
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
    const { sql } = await import("@/lib/db");
    const result = await sql`
      SELECT *
      FROM edits
      WHERE name = ${data.name} AND sample_id = ${data.sampleId}
    `;

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (err) {
    console.error("Failed to fetch edit:", err);
    return null;
  }
};
