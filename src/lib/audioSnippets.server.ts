import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";

export const addAudioSnippetSchema = z.object({
  actionToken: z.string().min(1),
  topicId: z.uuid(),
  perspectiveId: z.uuid(),
  r2Key: z.string().min(1),
  startTime: z.number().nonnegative().finite(),
  endTime: z.number().positive().finite(),
});

export const addAudioSnippet = async ({
  data,
}: {
  data: z.infer<typeof addAudioSnippetSchema>;
}) => {
  const verified = verifyActionToken({
    token: data.actionToken,
    requiredScope: "perspective:align",
    topicId: data.topicId,
  });
  if (!verified) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  if (data.endTime <= data.startTime) {
    return { ok: false as const, error: "endTime must be after startTime", status: 400 };
  }

  const rows = await sql<{ id: string }>`
    INSERT INTO audio_mix_snippets (perspective_id, r2_key, start_time, end_time)
    VALUES (${data.perspectiveId}, ${data.r2Key}, ${data.startTime}, ${data.endTime})
    RETURNING id;
  `;

  return { ok: true as const, snippetId: rows[0].id };
};

export const listAudioSnippets = async ({
  perspectiveId,
}: {
  perspectiveId: string;
}) => {
  const rows = await sql<{
    id: string;
    r2_key: string;
    start_time: number;
    end_time: number;
  }>`
    SELECT id, r2_key, start_time, end_time
    FROM audio_mix_snippets
    WHERE perspective_id = ${perspectiveId}
    ORDER BY start_time;
  `;

  return {
    ok: true as const,
    snippets: rows.map((row) => ({
      id: row.id,
      r2Key: row.r2_key,
      startTime: row.start_time,
      endTime: row.end_time,
    })),
  };
};

export const deleteAudioSnippet = async ({
  snippetId,
  perspectiveId,
}: {
  snippetId: string;
  perspectiveId: string;
}) => {
  const rows = await sql`
    DELETE FROM audio_mix_snippets
    WHERE id = ${snippetId}
      AND perspective_id = ${perspectiveId}
    RETURNING id;
  `;

  if (rows.length === 0) {
    return { ok: false as const, error: "Snippet not found", status: 404 };
  }

  return { ok: true as const };
};
