import { sql } from "@/lib/db.server";

const DEFAULT_PERSPECTIVE_SHARE_CLEANUP_BATCH_SIZE = 500;

const parseBatchSize = (value: string | undefined) => {
  if (!value) return DEFAULT_PERSPECTIVE_SHARE_CLEANUP_BATCH_SIZE;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PERSPECTIVE_SHARE_CLEANUP_BATCH_SIZE;
  }
  return parsed;
};

export const getPerspectiveShareCleanupBatchSize = () =>
  parseBatchSize(process.env.PERSPECTIVE_SHARE_CLEANUP_BATCH_SIZE);

export const purgePerspectiveShareCodes = async ({
  batchSize = getPerspectiveShareCleanupBatchSize(),
}: {
  batchSize?: number;
} = {}) => {
  const rows = await sql<{ id: string }>`
    DELETE FROM perspective_collaboration_codes
    WHERE id IN (
      SELECT id
      FROM perspective_collaboration_codes
      WHERE revoked_at IS NOT NULL
         OR exhausted_at IS NOT NULL
      ORDER BY COALESCE(exhausted_at, revoked_at, created_at) ASC
      LIMIT ${batchSize}
    )
    RETURNING id;
  `;

  return {
    batchSize,
    deletedCount: rows.length,
  };
};
