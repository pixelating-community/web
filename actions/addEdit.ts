"use server";

import type { UUID } from "node:crypto";
import { sql } from "@/lib/db";

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
