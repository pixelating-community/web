import postgres from "postgres";

const sql = postgres(
  `postgres://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DATABASE}`
);

try {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
  await sql`
    CREATE TABLE IF NOT EXISTS topics (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) NOT NULL,
      token VARCHAR(255) NOT NULL,
      locked BOOLEAN NOT NULL DEFAULT 't'
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS objectives (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      src VARCHAR(255) NOT NULL,
      description VARCHAR(255),
      width VARCHAR(255),
      height VARCHAR(255)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tracks (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) UNIQUE NOT NULL,
      src VARCHAR(255) NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS edits (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name VARCHAR(255) NOT NULL,
      track_id uuid REFERENCES tracks(id) ON DELETE CASCADE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS samples (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edit_id uuid REFERENCES edits(id) ON DELETE CASCADE,
      start_at DOUBLE PRECISION NOT NULL,
      end_at DOUBLE PRECISION NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS perspectives (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      perspective TEXT NOT NULL,
      color VARCHAR(255) NOT NULL,
      topic_id uuid REFERENCES topics(id) ON DELETE CASCADE,
      sample_id uuid REFERENCES samples(id) ON DELETE CASCADE,
      objective_id uuid REFERENCES objectives(id) ON DELETE CASCADE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS lyrics (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edit_id uuid REFERENCES edits(id) ON DELETE CASCADE,
      objective_id uuid REFERENCES objectives(id) ON DELETE CASCADE,
      lyric VARCHAR(255),
      style VARCHAR(255),
      start_at DOUBLE PRECISION NOT NULL,
      end_at DOUBLE PRECISION
    )
  `;

  await sql`
    INSERT INTO tracks (name, src) VALUES
      ('hurt',            'do-you-really-want-to-hurt-me.m4a'),
      ('ver',             'ver.mp3'),
      ('readmind',        'readmind.mp3'),
      ('getthere',        'getthere.m4a'),
      ('purple',          'purple.m4a'),
      ('bestpart',        'bestpart.m4a'),
      ('dirtycomputer',   'dirtycomputer.m4a'),
      ('nohero',          'nohero.m4a'),
      ('sleep',           'sleep.m4a'),
      ('umisays',         'umisays.m4a'),
      ('aaj',             'aaj.m4a'),
      ('worldwasonfire',  'worldwasonfire.m4a'),
      ('takeabow',        'takeabow.m4a'),
      ('allheroes',       'allheroes.m4a'),
      ('cult',            'cult.m4a'),
      ('freeus',          'freeurself.m4a'),
      ('ai',              'ai.m4a'),
      ('nothing',         'nothing.m4a'),
      ('resist',          'resist.m4a')
    ON CONFLICT (name) DO NOTHING
  `;

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
