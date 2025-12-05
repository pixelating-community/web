"use server";

import { sql } from "@/lib/db";

export const getCollection = async ({
  collectionId,
}: {
  collectionId: string;
}) => {
  const collected = await sql`
    SELECT
      (SELECT COUNT(*)
       FROM collected
       WHERE collected.collection_id = collections.id
         AND status = 'succeeded'
      ) AS collected,
      collections.total
    FROM collections
    WHERE collections.id = ${collectionId};
  `;
  return collected[0] ?? { collected: 0, total: 0 };
};
