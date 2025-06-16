"use server";

import { sql } from "@/lib/db";
import { UUID } from "crypto";

export const addEdit = async ({
  name,
  trackId,
}: {
  name: string;
  trackId: UUID;
}) => {
  const edit = await sql`
    INSERT INTO edits (name, track_id)
    VALUES (${name}, ${trackId})
    RETURNING id;
  `;

  return edit[0].id;
};
