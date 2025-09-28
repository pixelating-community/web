import postgres from "postgres";

const sql = postgres(
  `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DB}`,
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
  await safe(async () => {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;`;
  });

  const tables = [
    `CREATE TABLE IF NOT EXISTS topics (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL,
      locked BOOLEAN NOT NULL DEFAULT true
    );`,
    `CREATE TABLE IF NOT EXISTS objectives (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      src VARCHAR(255) NOT NULL,
      description VARCHAR(255),
      width VARCHAR(255),
      height VARCHAR(255)
    );`,
    `CREATE TABLE IF NOT EXISTS tracks (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) UNIQUE NOT NULL,
      src VARCHAR(255) NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS edits (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) NOT NULL,
      track_id uuid REFERENCES tracks(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS samples (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edit_id uuid REFERENCES edits(id) ON DELETE CASCADE,
      start_at DOUBLE PRECISION NOT NULL,
      end_at DOUBLE PRECISION NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS collections (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      name VARCHAR(255) NOT NULL,
      description VARCHAR(255) NOT NULL,
      total INTEGER NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    );`,
    `CREATE TABLE IF NOT EXISTS collected (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      stripe_charge_id TEXT UNIQUE NOT NULL,
      stripe_hash text UNIQUE NOT NULL,
      amount BIGINT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('succeeded', 'refunded'))
    );`,
    `CREATE TABLE IF NOT EXISTS perspectives (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      perspective TEXT NOT NULL,
      color VARCHAR(255) NOT NULL,
      topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
      sample_id uuid REFERENCES samples(id) ON DELETE CASCADE,
      objective_id uuid REFERENCES objectives(id) ON DELETE CASCADE,
      collection_id uuid REFERENCES collections(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS lyrics (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edit_id uuid REFERENCES edits(id) ON DELETE CASCADE,
      objective_id uuid REFERENCES objectives(id) ON DELETE CASCADE,
      lyric VARCHAR(255),
      style VARCHAR(255),
      start_at DOUBLE PRECISION NOT NULL,
      end_at DOUBLE PRECISION
    );`,
  ];

  for (const t of tables) {
    await safe(() => sql.unsafe(t));
  }

  await safe(() =>
    sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_collected_collection_status ON collected (collection_id, status);`,
    ),
  );

  await sql.end();
  console.log("✅ Migration complete.");
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
