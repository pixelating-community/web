import { SQL } from "bun";

const MIGRATION_LOCK_KEY = 908_443_271;

const parsePort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined) => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

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

  await sql.begin(async (tx) => {
    await tx.unsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS topics (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name VARCHAR(255) NOT NULL UNIQUE,
        short_title VARCHAR(64),
        emoji VARCHAR(16),
        token VARCHAR(255) NOT NULL,
        locked BOOLEAN NOT NULL DEFAULT true
      );
    `);
    await tx.unsafe(`
      ALTER TABLE topics
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS short_title VARCHAR(64),
      ADD COLUMN IF NOT EXISTS emoji VARCHAR(16),
      ADD COLUMN IF NOT EXISTS token VARCHAR(255) NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
      ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT true;
    `);

    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS collections (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NOT NULL,
        total INTEGER NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await tx.unsafe(`
      ALTER TABLE collections
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS collected (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        stripe_charge_id TEXT UNIQUE NOT NULL,
        stripe_hash TEXT UNIQUE NOT NULL,
        amount BIGINT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'refunded'))
      );
    `);

    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS perspectives (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        perspective TEXT NOT NULL,
        topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
        collection_id uuid REFERENCES collections(id) ON DELETE CASCADE,
        audio_src TEXT,
        start_time DOUBLE PRECISION,
        end_time DOUBLE PRECISION,
        symbols JSONB DEFAULT '[]',
        rendered_html TEXT,
        words_json TEXT
      );
    `);
    await tx.unsafe(`
      ALTER TABLE perspectives
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS audio_src TEXT,
      ADD COLUMN IF NOT EXISTS start_time DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS end_time DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS symbols JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS rendered_html TEXT,
      ADD COLUMN IF NOT EXISTS words_json TEXT;
    `);

    await tx.unsafe(`
      CREATE TABLE IF NOT EXISTS reflections (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
        reflection_id uuid REFERENCES reflections(id) ON DELETE CASCADE,
        text TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await tx.unsafe(`
      ALTER TABLE reflections
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_collected_collection_status
      ON collected (collection_id, status);
    `);
    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_reflections_perspective
      ON reflections (perspective_id);
    `);
    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_reflections_parent
      ON reflections (reflection_id);
    `);
    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_topics_name
      ON topics (name);
    `);
    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_perspectives_topic
      ON perspectives (topic_id);
    `);
    await tx.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_perspectives_collection
      ON perspectives (collection_id);
    `);

    if (parseBoolean(process.env.REQUIRE_EXISTING_DATA)) {
      const rows = await tx`
        SELECT
          (SELECT count(*) FROM topics) AS topics,
          (SELECT count(*) FROM perspectives) AS perspectives,
          (SELECT count(*) FROM reflections) AS reflections;
      `;
      const counts = rows[0] as
        | {
            topics?: unknown;
            perspectives?: unknown;
            reflections?: unknown;
          }
        | undefined;
      const topics = toNumber(counts?.topics);
      const perspectives = toNumber(counts?.perspectives);
      const reflections = toNumber(counts?.reflections);

      if (topics + perspectives + reflections === 0) {
        throw new Error(
          "REQUIRE_EXISTING_DATA is enabled but the database is empty. Refusing to continue.",
        );
      }
    }
  });

  console.log("Migration complete.");
} finally {
  if (lockAcquired) {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY});`;
  }
  await sql.close();
}
