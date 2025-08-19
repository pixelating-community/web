"use server";

import type { UUID } from "node:crypto";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const addCollection = async ({
  id,
  name,
  description,
  total,
}: {
  id: UUID;
  name: string;
  description: string;
  total: string;
}): Promise<{ id: UUID }> => {
  try {
    const schema = z.object({
      id: z.uuid(),
      name: z.string().min(1),
      description: z.string().min(1),
      total: z.number().min(1),
    });

    const data = schema.parse({
      id,
      name,
      description,
      total,
    });

    if (id && name && total && description) {
      const result =
        await sql`SELECT * FROM collections WHERE perspectiveId = ${data.id}
    `;

      if (result.length === 0) {
        throw new Error("edit not found");
      }

      const insertResult = await sql`
      `;

      console.log(insertResult);

      return { id };
    }
  } catch (error) {
    console.log(error);
  }
};
