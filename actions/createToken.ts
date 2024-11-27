"use server";

import { sql } from "@/lib/db";
import { UUID } from "crypto";
import { z } from "zod/v4";

export async function createToken(
  id: UUID,
  name: string,
  token: string,
  tokenKey: string,
  lock: boolean
) {
  try {
    const tokenKeys = [
      process.env.TS_KEY,
      process.env.EL_KEY,
      process.env.KR_KEY,
      process.env.KL_KEY,
    ];
    const schema = z.object({
      topic_id: z.string().min(1),
      name: z.string().min(1),
      token: z.string().min(1),
      token_key: z.string().min(1),
      lock: z.boolean(),
    });
    const data = schema.parse({
      id,
      name,
      token,
      token_key: tokenKey,
      lock,
    });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE id = ${id};
    `;
    if (isValid.length === 0 && tokenKeys.includes(data.token_key)) {
      await sql`
      INSERT INTO topics (name, token, lock)
      VALUES (${data.name}, crypt(${data.token}, gen_salt('bf')), ${lock});`;

      return { message: "TOKEN CREATED" };
    }
    return { message: "TOKEN EXISTS ALREADY" };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create token" };
  }
}
