import { SQL } from "bun";

const MIGRATION_LOCK_KEY = 908_443_271;

const truthyEnvValues = new Set(["1", "true", "yes"]);

type StatementExecutor = {
  unsafe: (statement: string) => Promise<unknown>;
};

type MigrationExecutor = StatementExecutor & {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

const parsePort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined) =>
  value ? truthyEnvValues.has(value.trim().toLowerCase()) : false;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const resolveConnectionString = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    return databaseUrl;
  }

  const host = process.env.POSTGRES_HOST ?? "postgres";
  const port = parsePort(process.env.POSTGRES_PORT, 5432);
  const username = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "postgres";
  const database = process.env.POSTGRES_DB ?? "postgres";

  return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const topicStatements = [
  "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
  `
    CREATE TABLE IF NOT EXISTS topics (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) NOT NULL UNIQUE,
      short_title VARCHAR(64),
      emoji VARCHAR(16),
      token VARCHAR(255) NOT NULL,
      locked BOOLEAN NOT NULL DEFAULT true
    );
  `,
  `
    ALTER TABLE topics
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS short_title VARCHAR(64),
    ADD COLUMN IF NOT EXISTS emoji VARCHAR(16),
    ADD COLUMN IF NOT EXISTS token VARCHAR(255) NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT true;
  `,
] as const;

const perspectiveStatements = [
  `
    CREATE TABLE IF NOT EXISTS perspectives (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      perspective TEXT NOT NULL,
      topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
      audio_src TEXT,
      image_src TEXT,
      remix_audio_src TEXT,
      remix_duration DOUBLE PRECISION,
      remix_waveform_json JSONB,
      remix_updated_at TIMESTAMPTZ,
      start_time DOUBLE PRECISION,
      end_time DOUBLE PRECISION,
      symbols JSONB DEFAULT '[]',
      rendered_html TEXT,
      words_json TEXT
    );
  `,
  `
    ALTER TABLE perspectives
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS audio_src TEXT,
    ADD COLUMN IF NOT EXISTS image_src TEXT,
    ADD COLUMN IF NOT EXISTS remix_audio_src TEXT,
    ADD COLUMN IF NOT EXISTS remix_duration DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS remix_waveform_json JSONB,
    ADD COLUMN IF NOT EXISTS remix_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS start_time DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS end_time DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS symbols JSONB DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS rendered_html TEXT,
    ADD COLUMN IF NOT EXISTS words_json TEXT,
    ADD COLUMN IF NOT EXISTS audio_mix_input_src TEXT,
    ADD COLUMN IF NOT EXISTS audio_mix_src TEXT,
    ADD COLUMN IF NOT EXISTS recording_src TEXT,
    ADD COLUMN IF NOT EXISTS raw_recording_src TEXT,
    ADD COLUMN IF NOT EXISTS parent_perspective_id uuid REFERENCES perspectives(id) ON DELETE CASCADE;
  `,
  `
    DO $$ BEGIN
      ALTER TABLE perspectives RENAME COLUMN video_src TO audio_mix_input_src;
    EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
    END $$;
  `,
  `
    DO $$ BEGIN
      ALTER TABLE perspectives RENAME COLUMN video_mix_src TO audio_mix_src;
    EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
    END $$;
  `,
  `
    ALTER TABLE perspectives
    DROP COLUMN IF EXISTS collection_id,
    DROP COLUMN IF EXISTS segment_effects_json;
  `,
] as const;

const retiredCollectionStatements = [
  "DROP INDEX IF EXISTS idx_reflections_perspective;",
  "DROP INDEX IF EXISTS idx_reflections_parent;",
  "DROP TABLE IF EXISTS reflections CASCADE;",
  "DROP INDEX IF EXISTS idx_collected_collection_status;",
  "DROP INDEX IF EXISTS idx_perspectives_collection;",
  "DROP TABLE IF EXISTS collected;",
  "DROP TABLE IF EXISTS collections;",
] as const;

const collaborationCodeStatements = [
  `
    CREATE TABLE IF NOT EXISTS perspective_collaboration_codes (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 2 CHECK (max_uses > 0),
      used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_redeemed_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      exhausted_at TIMESTAMPTZ
    );
  `,
  `
    ALTER TABLE perspective_collaboration_codes
    ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 2,
    ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_redeemed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS exhausted_at TIMESTAMPTZ;
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_perspective_collaboration_codes_lookup
    ON perspective_collaboration_codes (perspective_id, code_hash);
  `,
  `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_perspective_collaboration_codes_active
    ON perspective_collaboration_codes (perspective_id)
    WHERE revoked_at IS NULL;
  `,
] as const;

const audioImportStatements = [
  `
    CREATE TABLE IF NOT EXISTS audio_import_jobs (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
      topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
      r2_key TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
  `,
  `
    ALTER TABLE audio_import_jobs
    ADD COLUMN IF NOT EXISTS perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS source_url TEXT NOT NULL,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS r2_key TEXT,
    ADD COLUMN IF NOT EXISTS audio_import_r2_key TEXT,
    ADD COLUMN IF NOT EXISTS error TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  `,
  `
    DO $$ BEGIN
      ALTER TABLE audio_import_jobs RENAME COLUMN video_r2_key TO audio_import_r2_key;
    EXCEPTION WHEN undefined_column OR duplicate_column THEN NULL;
    END $$;
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_audio_import_jobs_pending
    ON audio_import_jobs (status, created_at)
    WHERE status = 'pending';
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_audio_import_jobs_perspective
    ON audio_import_jobs (perspective_id);
  `,
] as const;

const legacyAudioRenameStatements = [
  `
    DO $$ BEGIN
      ALTER TABLE video_mix_snippets RENAME TO audio_mix_snippets;
    EXCEPTION WHEN undefined_table OR duplicate_table THEN NULL;
    END $$;
  `,
  `
    DO $$ BEGIN
      ALTER TABLE video_mix_jobs RENAME TO audio_mix_jobs;
    EXCEPTION WHEN undefined_table OR duplicate_table THEN NULL;
    END $$;
  `,
] as const;

const audioMixStatements = [
  `
    CREATE TABLE IF NOT EXISTS audio_mix_snippets (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
      r2_key TEXT NOT NULL,
      start_time DOUBLE PRECISION NOT NULL,
      end_time DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_audio_mix_snippets_perspective
    ON audio_mix_snippets (perspective_id);
  `,
  `
    CREATE TABLE IF NOT EXISTS audio_mix_jobs (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
      r2_key TEXT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_audio_mix_jobs_pending
    ON audio_mix_jobs (status, created_at)
    WHERE status = 'pending';
  `,
] as const;

const indexStatements = [
  "CREATE INDEX IF NOT EXISTS idx_topics_name ON topics (name);",
  "CREATE INDEX IF NOT EXISTS idx_perspectives_topic ON perspectives (topic_id);",
  `
    CREATE INDEX IF NOT EXISTS idx_perspectives_parent
    ON perspectives (parent_perspective_id)
    WHERE parent_perspective_id IS NOT NULL;
  `,
] as const;

const migrationGroups = [
  topicStatements,
  perspectiveStatements,
  retiredCollectionStatements,
  collaborationCodeStatements,
  audioImportStatements,
  legacyAudioRenameStatements,
  audioMixStatements,
  indexStatements,
] as const;

const runStatements = async (
  executor: StatementExecutor,
  statements: readonly string[],
) => {
  for (const statement of statements) {
    await executor.unsafe(statement);
  }
};

const assertExistingDataIfRequired = async (tx: MigrationExecutor) => {
  if (!parseBoolean(process.env.REQUIRE_EXISTING_DATA)) return;

  const rows = await tx`
    SELECT
      (SELECT count(*) FROM topics) AS topics,
      (SELECT count(*) FROM perspectives) AS perspectives;
  `;
  const counts = rows[0] as
    | {
        topics?: unknown;
        perspectives?: unknown;
      }
    | undefined;
  const topics = toNumber(counts?.topics);
  const perspectives = toNumber(counts?.perspectives);

  if (topics + perspectives === 0) {
    throw new Error(
      "REQUIRE_EXISTING_DATA is enabled but the database is empty. Refusing to continue.",
    );
  }
};

const runMigrations = async () => {
  await sql.begin(async (tx) => {
    for (const statements of migrationGroups) {
      await runStatements(tx, statements);
    }
    await assertExistingDataIfRequired(tx);
  });
};

const sql = new SQL(resolveConnectionString());
let lockAcquired = false;

try {
  const lockRows = await sql`
    SELECT pg_try_advisory_lock(${MIGRATION_LOCK_KEY}) AS locked;
  `;
  lockAcquired = Boolean(
    (lockRows[0] as { locked?: boolean } | undefined)?.locked,
  );
  if (!lockAcquired) {
    throw new Error("Migration lock is already held by another process.");
  }

  await runMigrations();
  console.log("Migration complete.");
} finally {
  if (lockAcquired) {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY});`;
  }
  await sql.close();
}
