"use server";

import { z } from "zod";

export const addSample = async ({
  name,
  src,
}: {
  name: string;
  src: string;
}) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      src: z.string().url(),
    });
    const data = schema.parse({ name, src });
    const { sql } = await import("@/lib/db");

    const result = await sql`
      INSERT INTO samples (name, src)
      VALUES (${data.name}, ${data.src})
      ON CONFLICT (name) DO UPDATE SET src = ${data.src}
      RETURNING *
    `;

    return result[0];
  } catch (err) {
    console.error("Failed to add sample:", err);
    throw new Error("Failed to add sample");
  }
};
