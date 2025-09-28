"use server";

import type { UUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const deletePerspective = async ({
  perspectiveId,
}: {
  perspectiveId: UUID;
}) => {
  try {
    const schema = z.object({
      perspectiveId: z.uuidv7(),
    });
    const data = schema.parse({
      perspectiveId,
    });

    await sql`DELETE FROM perspectives WHERE id=${data.perspectiveId};`;
    revalidatePath("/");
  } catch (e) {
    console.log(e, { message: "Failed to delete perspective" });
  }
};
