import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";

export const audioMixSchema = z.object({
  actionToken: z.string().min(1),
  topicId: z.uuid(),
  perspectiveId: z.uuid(),
});

export const enqueueAudioMix = async ({
  data,
}: {
  data: z.infer<typeof audioMixSchema>;
}) => {
  const verified = verifyActionToken({
    token: data.actionToken,
    requiredScope: "perspective:align",
    topicId: data.topicId,
  });
  if (!verified) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  const perspectiveRows = await sql<{ id: string; audio_mix_input_src: string | null }>`
    SELECT id, audio_mix_input_src FROM perspectives
    WHERE id = ${data.perspectiveId}
    LIMIT 1;
  `;
  if (perspectiveRows.length === 0) {
    return { ok: false as const, error: "Perspective not found", status: 404 };
  }
  if (!perspectiveRows[0].audio_mix_input_src) {
    return { ok: false as const, error: "No audio source", status: 400 };
  }

  const snippetCount = await sql<{ count: number }>`
    SELECT count(*)::int AS count
    FROM audio_mix_snippets
    WHERE perspective_id = ${data.perspectiveId};
  `;
  if ((snippetCount[0]?.count ?? 0) === 0) {
    return { ok: false as const, error: "No snippets to mix", status: 400 };
  }

  const existing = await sql<{ id: string }>`
    SELECT id FROM audio_mix_jobs
    WHERE perspective_id = ${data.perspectiveId}
      AND status IN ('pending', 'processing')
    LIMIT 1;
  `;
  if (existing.length > 0) {
    return {
      ok: true as const,
      jobId: existing[0].id,
      status: "already_queued" as const,
    };
  }

  const rows = await sql<{ id: string }>`
    INSERT INTO audio_mix_jobs (perspective_id)
    VALUES (${data.perspectiveId})
    RETURNING id;
  `;

  return {
    ok: true as const,
    jobId: rows[0].id,
    status: "queued" as const,
  };
};

export const getAudioMixJobStatus = async ({
  jobId,
}: {
  jobId: string;
}) => {
  const rows = await sql<{
    id: string;
    status: string;
    r2_key: string | null;
    error: string | null;
    created_at: string;
    completed_at: string | null;
  }>`
    SELECT id, status, r2_key, error, created_at, completed_at
    FROM audio_mix_jobs
    WHERE id = ${jobId}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    return { ok: false as const, error: "Job not found", status: 404 };
  }

  const row = rows[0];
  return {
    ok: true as const,
    job: {
      id: row.id,
      status: row.status,
      r2Key: row.r2_key,
      error: row.error,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    },
  };
};
