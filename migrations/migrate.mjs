import postgres from "postgres";

const sql = postgres(
  `postgres://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DATABASE}`
);
try {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`;
  await sql`CREATE TABLE IF NOT EXISTS
  perspectives (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), perspective TEXT NOT NULL, topic_id VARCHAR (255) NOT NULL, color VARCHAR (255) NOT NULL, objective_key VARCHAR (255))`;
  await sql`CREATE TABLE IF NOT EXISTS
  topics (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), topic_id VARCHAR (255), token VARCHAR (255) NOT NULL, lock BOOLEAN NOT NULL DEFAULT 't')`;
  await sql`CREATE TABLE IF NOT EXISTS
  objectives (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), objective_key VARCHAR (255) NOT NULL, topic_id VARCHAR (255), description VARCHAR (255), width VARCHAR (255), height VARCHAR (255))`;
  process.exit(0);
} catch (error) {
  console.log(error);
  process.exit(1);
}
