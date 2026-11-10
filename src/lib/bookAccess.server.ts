import "@tanstack/react-start/server-only";
import { createHash } from "node:crypto";
import { sql } from "@/lib/db.server";
import { isBookAuthor } from "@/lib/bookAuth.server";

export const hashBookToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const readerCookie = (request: Request) =>
  (request.headers.get("cookie") ?? "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("book_reader="))
    ?.slice(12) ?? "";
export const getBookReader = async (request?: Request) => {
  if (!request) return null;
  const token = readerCookie(request);
  if (!token) return null;
  const rows = await sql<{
    id: string;
    email: string;
  }>`SELECT r.id, r.email FROM book_readers r JOIN book_reader_sessions s ON s.reader_id=r.id WHERE s.hash=${hashBookToken(token)} AND s.expires_at>NOW();`;
  return rows[0] ?? null;
};
export const hasBookPurchase = async (request?: Request) => {
  const reader = await getBookReader(request);
  if (!reader) return false;
  const rows =
    await sql`SELECT id FROM book_orders WHERE reader_id=${reader.id} AND paid AND refunded_minor<amount_minor LIMIT 1;`;
  return rows.length > 0;
};
export const canReadBookTopic = async (topicId: string, request?: Request) => {
  const rows = await sql<{
    published: boolean;
    free: boolean;
  }>`SELECT published, free FROM chapters WHERE topic_id=${topicId};`;
  if (!rows[0]) return true;
  if (request && isBookAuthor(request)) return true;
  return (
    rows[0].published && (rows[0].free || (await hasBookPurchase(request)))
  );
};
export const canReadBookPerspective = async (id: string, request?: Request) => {
  const rows = await sql<{
    topic_id: string;
  }>`SELECT topic_id FROM perspectives WHERE id=${id};`;
  return !rows[0] || canReadBookTopic(rows[0].topic_id, request);
};
