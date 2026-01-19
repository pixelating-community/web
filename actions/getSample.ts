"use server";

import { z } from "zod";

export const getSample = async ({ idOrName }: { idOrName: string }) => {
  try {
    const schema = z.object({
      idOrName: z.string().min(1),
    });
    const data = schema.parse({ idOrName });
    const { sql } = await import("@/lib/db");
    const isUuid = z.string().uuid().safeParse(data.idOrName).success;
    const result = isUuid
      ? await sql`
          SELECT *
          FROM samples
          WHERE id = ${data.idOrName}
        `
      : await sql`
          SELECT *
          FROM samples
          WHERE name = ${data.idOrName}
        `;

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (err) {
    console.error("Failed to fetch sample:", err);
    return null;
  }
};
