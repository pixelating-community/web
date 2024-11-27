import postgres from "postgres";

export const sql = postgres(
  `postgres://${process.env.POSTGRES_USERNAME}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DATABASE}`
);
