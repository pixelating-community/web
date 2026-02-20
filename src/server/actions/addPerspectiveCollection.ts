import { z } from "zod/v4";
import { sql } from "@/lib/db";

export const addPerspectiveCollection = async ({
  id,
  perspectiveId,
}: {
  id: string;
  perspectiveId: string;
}): Promise<{
  id: string;
  collection: { id: string } | null;
} | null> => {
  try {
    const schema = z.object({
      id: z.uuid(),
      perspectiveId: z.uuid(),
    });

    const data = schema.parse({ id, perspectiveId });

    const perspective = await sql<{
      id: string;
      collection_id: string | null;
    }>`
      UPDATE perspectives
      SET collection_id = ${data.id}
      WHERE id = ${data.perspectiveId}
      RETURNING id, collection_id
    `;

    if (perspective.length === 0) {
      throw new Error("collection not created");
    }
    if (!perspective[0].collection_id) {
      throw new Error("collection id was not persisted");
    }

    return {
      id: perspective[0].id,
      collection: {
        id: perspective[0].collection_id,
      },
    };
  } catch (error) {
    console.error("Error adding collection:", error);
    return null;
  }
};
