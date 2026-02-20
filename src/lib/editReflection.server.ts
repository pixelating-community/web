import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import {
  getReflectionWriteCookieName,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
};

export const editReflection = async ({
  id,
  text,
  cookieStore,
}: {
  id: string;
  text: string;
  cookieStore?: CookieStore;
}) => {
  try {
    const schema = z.object({
      id: z.uuid(),
      text: z.string().min(1).max(5000),
    });

    const data = schema.parse({ id, text });

    const reflectionRows = await sql`
      SELECT perspective_id
      FROM reflections
      WHERE id = ${data.id}
      LIMIT 1;
    `;

    if (reflectionRows.length === 0) {
      throw new Error("reflection not found");
    }

    const perspectiveId = reflectionRows[0].perspective_id as string;
    if (!cookieStore) {
      throw new Error("cookie store required");
    }
    const token = cookieStore.get(
      getReflectionWriteCookieName(perspectiveId),
    )?.value;
    const hasWriteGrant = verifyReflectionWriteToken(token, perspectiveId);
    if (!hasWriteGrant) {
      throw new Error("write token not valid");
    }

    const result = await sql`
      UPDATE reflections
      SET text = ${data.text}, updated_at = NOW()
      WHERE id = ${data.id}
      RETURNING id, perspective_id, reflection_id, text, updated_at, created_at
    `;

    if (result.length === 0) {
      throw new Error(`Reflection edit failed: ${data.id}`);
    }
    return result[0];
  } catch (error) {
    console.log(`${error}`);
  }
};
