import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const getTopic = async ({ name }: { name: string }) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
    });

    const data = schema.parse({ name });

    const result = await sql`
      SELECT id, name, token, locked
      FROM topics
      WHERE name = ${data.name}
      LIMIT 1;
    `;

    if (result.length === 0) {
      throw new Error(`Topic not found: ${data.name}`);
    }

    return result[0];
  } catch (error) {
    console.log(`${error}`);
  }
};
