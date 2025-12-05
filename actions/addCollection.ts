"use server";

import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const addCollection = async ({
  name,
  description,
  total,
}: {
  name: string;
  description: string;
  total: number;
}): Promise<{
  id: string | null;
  name: string;
  description: string;
  total: number | null;
} | null> => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().min(1),
      total: z.number().min(1),
    });

    const data = schema.parse({ name, description, total });

    const collection = await sql`
      INSERT INTO collections (name, description, total)
      VALUES (${data.name}, ${data.description}, ${data.total * 100} )
      RETURNING id, name, description, total
    `;

    if (collection.length === 0) {
      throw new Error("collection not created");
    }

    return {
      id: collection[0].id as string,
      name: collection[0].name as string,
      description: collection[0].description as string,
      total: collection[0].total as number,
    };
  } catch (error) {
    console.error("Error adding collection:", error);
    return null;
  }
};
