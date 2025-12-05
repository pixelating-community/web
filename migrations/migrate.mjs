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

const safeConstraint = async (statement, name) => {
  try {
    await statement();
  } catch (err) {
    if (err.code === "42710") {
      console.log(`✅ Constraint ${name} already exists`);
    } else if (err.code === "23505") {
      console.log(`⚠️ Constraint ${name} skipped: duplicate values exist`);
    } else {
      throw err;
    }
  }
};

try {
  await safe(() => sql`CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;`);

  await sql.unsafe(`DROP TABLE IF EXISTS tracks CASCADE;`);
  await sql.unsafe(`DROP TABLE IF EXISTS edits CASCADE;`);
  await sql.unsafe(`DROP TABLE IF EXISTS samples CASCADE;`);
  await sql.unsafe(`DROP TABLE IF EXISTS objectives CASCADE;`);
  await sql.unsafe(`DROP TABLE IF EXISTS lyrics CASCADE;`);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS topics (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) NOT NULL UNIQUE,
      token VARCHAR(255) NOT NULL,
      locked BOOLEAN NOT NULL DEFAULT true
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS collections (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      name VARCHAR(255) NOT NULL,
      description VARCHAR(255) NOT NULL,
      total INTEGER NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS collected (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      stripe_charge_id TEXT UNIQUE NOT NULL,
      stripe_hash TEXT UNIQUE NOT NULL,
      amount BIGINT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('succeeded', 'refunded'))
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS perspectives (
      id uuid PRIMARY KEY DEFAULT uuidv7(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      perspective TEXT NOT NULL,
      topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
      collection_id uuid REFERENCES collections(id) ON DELETE CASCADE
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS reflections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      perspective_id uuid NOT NULL REFERENCES perspectives(id) ON DELETE CASCADE,
      reflection_id uuid REFERENCES reflections(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_collected_collection_status
    ON collected (collection_id, status);
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_reflections_perspective
    ON reflections (perspective_id);
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_reflections_parent
    ON reflections (reflection_id);
  `);

  await safeConstraint(
    () =>
      sql.unsafe(
        `ALTER TABLE topics ADD CONSTRAINT topics_name_key UNIQUE (name);`,
      ),
    "topics_name_key",
  );

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_topics_name
    ON topics (name);
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_perspectives_topic
    ON perspectives (topic_id);
  `);

  await sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_perspectives_collection
    ON perspectives (collection_id);
  `);

  await sql.unsafe(
    `ALTER TABLE perspectives DROP COLUMN IF EXISTS sample_id CASCADE;`,
  );
  await sql.unsafe(
    `ALTER TABLE perspectives DROP COLUMN IF EXISTS objective_id CASCADE;`,
  );

  await sql.end();
  console.log("✅ Migration complete.");
} catch (err) {
  console.error(err);
  process.exit(1);
}
