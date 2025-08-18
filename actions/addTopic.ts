"use server";

import { sql } from "@/lib/db";
import { z } from "zod/v4";

export async function addTopic({
  name,
  key,
  token,
  locked,
}: {
  name: string;
  key: string;
  token: string;
  locked?: boolean;
}): Promise<{ name: string }> {
  const tokenKeys = [process.env.TS_KEY, process.env.EL_KEY];
  try {
    const schema = z.object({
      name: z.string().min(1),
      key: z.string().min(1),
      token: z.string().min(1),
      locked: z.boolean().optional(),
    });
    const data = schema.parse({
      name,
      key,
      token,
      locked: locked ?? false,
    });
    const isValid = await sql`
      SELECT token = crypt(${data.token}::text, token) FROM topics WHERE name = ${data.name};
    `;
    if (isValid.length === 0 && tokenKeys.includes(data.key)) {
      await sql`INSERT INTO topics (name, token, locked) VALUES (
      ${data.name},
        crypt(${data.token}::text, gen_salt('bf')),
        ${data.locked}
      ) ON CONFLICT DO NOTHING;`;

      return { name: data.name };
    }
    return;
  } catch (e) {
    console.log(e, { message: "Failed to add topic" });
  }
}
