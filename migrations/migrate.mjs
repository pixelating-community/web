import postgres from "postgres";

const sql = postgres(
  `postgres://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DATABASE}`,
);

const safe = async (statement) => {
  try {
    await statement();
  } catch (err) {
    if (["42P07", "42710"].includes(err.code)) {
      console.log(`✅ Skipping existing object: ${err.message}`);
    } else {
      throw err;
    }
  }
};

try {
  await safe(() => sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS topics (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        locked BOOLEAN NOT NULL DEFAULT 't'
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS objectives (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        src VARCHAR(255) NOT NULL,
        description VARCHAR(255),
        width VARCHAR(255),
        height VARCHAR(255)
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS tracks (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name VARCHAR(255) UNIQUE NOT NULL,
        src VARCHAR(255) NOT NULL
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS edits (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        name VARCHAR(255) NOT NULL,
        track_id uuid REFERENCES tracks(id) ON DELETE CASCADE
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS samples (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        edit_id uuid REFERENCES edits(id) ON DELETE CASCADE,
        start_at DOUBLE PRECISION NOT NULL,
        end_at DOUBLE PRECISION NOT NULL
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS perspectives (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        perspective TEXT NOT NULL,
        color VARCHAR(255) NOT NULL,
        topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
        sample_id uuid REFERENCES samples(id) ON DELETE CASCADE,
        objective_id uuid REFERENCES objectives(id) ON DELETE CASCADE,
        collection_id uuid REFERENCES collections(id) ON DELETE CASCADE
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS lyrics (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        edit_id uuid REFERENCES edits(id) ON DELETE CASCADE,
        objective_id uuid REFERENCES objectives(id) ON DELETE CASCADE,
        lyric VARCHAR(255),
        style VARCHAR(255),
        start_at DOUBLE PRECISION NOT NULL,
        end_at DOUBLE PRECISION
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS collections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description VARCHAR(255) NOT NULL,
        total INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `,
  );

  await safe(
    () =>
      sql`
      CREATE TABLE IF NOT EXISTS collected (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        stripe_charge_id TEXT UNIQUE NOT NULL,
        amount BIGINT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'refunded')),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `,
  );

  await safe(
    () =>
      sql`CREATE INDEX IF NOT EXISTS idx_collected_collection_status ON collected (collection_id, status);`,
  );

  await safe(
    () =>
      sql`
      ALTER TABLE perspectives
      ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES collections(id) ON DELETE CASCADE;
    `,
  );

  await sql.end();
  console.log("✅...");
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
