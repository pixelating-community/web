"use server";

import { sql } from "@/lib/db";
import { z } from "zod/v4";
import { UUID } from "crypto";

export const isLocked = async ({ id }: { id: UUID }) => {
  try {
    const schema = z.object({
      id: z.uuid(),
    });
    const data = schema.parse({
      id,
    });

    const res = await sql`SELECT locked FROM topics WHERE id = ${data.id};`;
    if (res[0]) {
      const locked = res[0].locked;
      return !!locked;
    }

    return null;
  } catch (e) {
    console.error(e, { message: "Failed to get lock" });
  }
};
