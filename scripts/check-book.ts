// Local smoke test: creates and removes only its own uniquely named chapter.
import { SQL } from "bun";
const db = new SQL(
  process.env.DATABASE_URL ||
    `postgres://${encodeURIComponent(process.env.POSTGRES_USER || "postgres")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "postgres")}@${process.env.POSTGRES_HOST || "postgres"}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || "postgres"}`,
);
const origin = "http://localhost:3000";
const slug = `smoke-${Date.now()}`;
let cookie = "";
let topicId = "";
let readerId = "";
const assert = (ok: unknown, label: string) => {
  if (!ok) throw new Error(label);
};
async function action(data: object, authenticated = true) {
  const r = await fetch(`${origin}/api/obj/book`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authenticated ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(data),
  });
  return { response: r, data: await r.json() };
}
try {
  const login = await action({
    action: "login",
    key:
      process.env.BOOK_AUTHOR_KEY || process.env.EL_KEY || process.env.TS_KEY,
  });
  assert(login.response.ok, "author login");
  cookie = login.response.headers.get("set-cookie")!.split(";")[0];
  const made = await action({
    action: "createChapter",
    title: "Smoke chapter",
    slug,
  });
  assert(made.response.ok, "create chapter");
  const chapterId = made.data.chapterId;
  const settings = await db`SELECT slug FROM book_settings`;
  const book = settings[0].slug;
  const rows = await db`SELECT topic_id FROM chapters WHERE id=${chapterId}`;
  topicId = rows[0].topic_id;
  const authorPage = await fetch(`${origin}/${book}/write?draft=${chapterId}`, {
    headers: { Cookie: cookie },
  });
  assert(
    authorPage.ok,
    `author draft page ${authorPage.status}: ${(await authorPage.text()).slice(-2500)}`,
  );
  const drafts =
    await db`SELECT revision FROM chapter_drafts WHERE chapter_id=${chapterId}`;
  assert(drafts.length, "initialize draft");
  const perspectiveId = crypto.randomUUID();
  const text = `Private smoke text ${slug}`;
  const draft = {
    title: "Smoke chapter",
    position: 999,
    free: false,
    perspectives: [{ id: perspectiveId, text }],
  };
  const saved = await action({
    action: "saveDraft",
    chapterId,
    revision: drafts[0].revision,
    draft,
  });
  assert(saved.response.ok, "save draft");
  const denied = await action(
    { action: "saveDraft", chapterId, revision: saved.data.revision, draft },
    false,
  );
  assert(!denied.response.ok, "reject anonymous edit");
  const conflict = await action({
    action: "saveDraft",
    chapterId,
    revision: drafts[0].revision,
    draft,
  });
  assert(!conflict.response.ok, "reject stale save");
  const before =
    await db`SELECT id FROM perspectives WHERE id=${perspectiveId}`;
  assert(!before.length, "draft not published");
  const published = await action({
    action: "publish",
    chapterId,
    revision: saved.data.revision,
  });
  assert(published.response.ok, `publish: ${JSON.stringify(published.data)}`);
  for (const path of [
    `/${book}/c/${slug}`,
    `/t/${slug}`,
    `/p/${perspectiveId}`,
    `/api/t/${slug}`,
    `/api/p/${perspectiveId}/prompt`,
  ]) {
    const r = await fetch(origin + path);
    const body = await r.text();
    assert(!body.includes(text), `paid text leaked: ${path}`);
  }
  const readers =
    await db`INSERT INTO book_readers(email) VALUES (${slug + "@example.test"}) RETURNING id`;
  readerId = readers[0].id;
  const { createHash } = await import("node:crypto");
  const readerToken = crypto.randomUUID();
  await db`INSERT INTO book_reader_sessions(hash,reader_id,expires_at) VALUES (${createHash("sha256").update(readerToken).digest("hex")},${readerId},NOW()+INTERVAL '1 hour')`;
  const orders =
    await db`INSERT INTO book_orders(reader_id,amount_minor,paid) VALUES (${readerId},500,true) RETURNING id`;
  const paidPage = await fetch(`${origin}/${book}/c/${slug}`, {
    headers: { Cookie: `book_reader=${readerToken}` },
  });
  assert((await paidPage.text()).includes(text), "buyer can read paid chapter");
  await db`UPDATE book_orders SET refunded_minor=amount_minor WHERE id=${orders[0].id}`;
  const refundedPage = await fetch(`${origin}/${book}/c/${slug}`, {
    headers: { Cookie: `book_reader=${readerToken}` },
  });
  assert(!(await refundedPage.text()).includes(text), "refunded buyer denied");
  const freeSaved = await action({
    action: "saveDraft",
    chapterId,
    revision: published.data.revision,
    draft: { ...draft, free: true },
  });
  assert(freeSaved.response.ok, "mark free");
  const freePublished = await action({
    action: "publish",
    chapterId,
    revision: freeSaved.data.revision,
  });
  assert(freePublished.response.ok, "publish free");
  const freePage = await fetch(`${origin}/${book}/c/${slug}`);
  assert((await freePage.text()).includes(text), "free chapter visible");
  console.log(
    "Book smoke passed: login, draft privacy, concurrent edits, publishing, paywall alternate paths, free access.",
  );
} finally {
  if (readerId) {
    await db`DELETE FROM book_orders WHERE reader_id=${readerId}`;
    await db`DELETE FROM book_reader_sessions WHERE reader_id=${readerId}`;
    await db`DELETE FROM book_readers WHERE id=${readerId}`;
  }
  if (topicId) await db`DELETE FROM topics WHERE id=${topicId}`;
  await db.close();
}
