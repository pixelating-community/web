"use server";

import type { UUID } from "node:crypto";
import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const addPerspectiveCollection = async ({
  id,
  perspectiveId,
}: {
  id: UUID;
  perspectiveId: UUID;
}): Promise<{
  id: UUID;
  collection: { id: UUID } | null;
} | null> => {
  try {
    const schema = z.object({
      id: z.uuid(),
      perspectiveId: z.uuid(),
    });

    const data = schema.parse({ id, perspectiveId });

    const perspective = await sql`
      UPDATE perspectives
      SET collection_id = ${data.id}
      WHERE id = ${data.perspectiveId}
      RETURNING id, collection_id
    `;

    if (perspective.length === 0) {
      throw new Error("collection not created");
    }

    return {
      id: perspective[0].id as UUID,
      collection: {
        id: perspective[0].collection_id as UUID,
      },
    };
  } catch (error) {
    console.error("Error adding collection:", error);
    return null;
  }
};
