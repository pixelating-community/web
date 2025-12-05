"use server";

import { z } from "zod/v4";
import type { ReflectionData } from "@/components/ReflectionTree";
import { sql } from "@/lib/db";

export const getReflections = async ({
  id,
}: {
  id: string;
}): Promise<ReflectionData[]> => {
  try {
    const schema = z.object({
      id: z.uuid(),
    });

    const data = schema.parse({ id });

    const rows = await sql`
      SELECT id, perspective_id, reflection_id, text, updated_at, created_at
      FROM reflections
      WHERE perspective_id = ${data.id}
      ORDER BY created_at ASC
    `;

    const reflections: ReflectionData[] = rows.map((r) => ({
      id: r.id,
      perspective_id: r.perspective_id,
      reflection_id: r.reflection_id ?? null,
      text: r.text ?? "",
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    return reflections;
  } catch (error) {
    console.error("Failed to get reflections:", error);
    return [];
  }
};
