import "@tanstack/react-start/server-only";
import { canReadBookTopic } from "@/lib/bookAccess.server";
import { randomBytes } from "node:crypto";
import type { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import { hashTopicToken } from "@/lib/topicToken";
import { requireBookAuthor, isBookAuthor } from "@/lib/bookAuth.server";
import { bookDraftSchema, type bookActionSchema } from "@/lib/book.schema";
import type { BookSettings, BookChapter } from "@/lib/book";

export const getBookSettings = async (): Promise<BookSettings> => {
  const rows =
    await sql<BookSettings>`SELECT slug, title, author, introduction, price_minor FROM book_settings WHERE singleton = true;`;
  if (!rows[0])
    throw new Error("Run the database migration to set up the book.");
  return rows[0];
};

export const listBookChapters = async (
  request: Request,
): Promise<BookChapter[]> => {
  const author = isBookAuthor(request);
  return sql<BookChapter>`
    SELECT c.id, t.name AS slug, COALESCE(c.title, t.short_title, t.name) AS title,
      c.position, c.published, c.free
    FROM chapters c JOIN topics t ON t.id = c.topic_id
    WHERE c.published OR ${author}
    ORDER BY c.position, c.id;
  `;
};

export const getBookChapter = async (slug: string, request: Request) => {
  const chapters = await listBookChapters(request);
  const chapter = chapters.find((item) => item.slug === slug);
  if (!chapter) return null;
  const links = await sql<{
    topic_id: string;
  }>`SELECT topic_id FROM chapters WHERE id=${chapter.id};`;
  if (!(await canReadBookTopic(links[0].topic_id, request)))
    return {
      chapter,
      perspectives: [],
      chapters: chapters.filter((x) => x.published),
      paywall: true,
    };
  const perspectives = await sql<{ id: string; text: string }>`
    SELECT p.id, p.perspective AS text FROM perspectives p
    JOIN chapters c ON c.topic_id = p.topic_id
    JOIN topics t ON t.id = c.topic_id
    WHERE c.id = ${chapter.id} AND c.published AND NOT t.locked
      AND p.parent_perspective_id IS NULL
    ORDER BY array_position(c.perspective_order, p.id) NULLS LAST, p.id;
  `;
  return {
    chapter,
    perspectives,
    chapters: chapters.filter((item) => item.published),
  };
};

export const getBookDraft = async (chapterId: string, request: Request) => {
  requireBookAuthor(request);
  const chapters = await listBookChapters(request);
  const chapter = chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new Error("Chapter not found.");
  const existing = await sql<{ revision: number; draft: unknown }>`
    SELECT revision, draft FROM chapter_drafts WHERE chapter_id = ${chapterId};
  `;
  if (existing[0])
    return {
      chapter,
      revision: existing[0].revision,
      draft: bookDraftSchema.parse(
        typeof existing[0].draft === "string"
          ? JSON.parse(existing[0].draft)
          : existing[0].draft,
      ),
    };
  const perspectives = await sql<{ id: string; text: string }>`
    SELECT p.id, p.perspective AS text FROM perspectives p
    JOIN chapters c ON c.topic_id = p.topic_id
    JOIN topics t ON t.id = c.topic_id
    WHERE c.id = ${chapterId} AND NOT t.locked AND p.parent_perspective_id IS NULL
    ORDER BY array_position(c.perspective_order, p.id) NULLS LAST, p.id;
  `;
  const draft = {
    title: chapter.title,
    position: chapter.position,
    free: chapter.free,
    perspectives,
  };
  await sql`
    INSERT INTO chapter_drafts (chapter_id, draft, base_hash)
    VALUES (${chapterId}, ${draft}::jsonb, (SELECT md5(COALESCE(string_agg(p.id::text || p.perspective,'' ORDER BY p.id),'')) FROM perspectives p JOIN chapters c ON c.topic_id=p.topic_id WHERE c.id=${chapterId} AND p.parent_perspective_id IS NULL))
    ON CONFLICT (chapter_id) DO NOTHING;
  `;
  // Another author tab may have created the draft while we loaded its content.
  const rows = await sql<{ revision: number; draft: unknown }>`
    SELECT revision, draft FROM chapter_drafts WHERE chapter_id = ${chapterId};
  `;
  return {
    chapter,
    revision: rows[0].revision,
    draft: bookDraftSchema.parse(
      typeof rows[0].draft === "string"
        ? JSON.parse(rows[0].draft)
        : rows[0].draft,
    ),
  };
};

export const mutateBook = async (
  data: Exclude<
    z.infer<typeof bookActionSchema>,
    { action: "login" | "logout" }
  >,
  request: Request,
) => {
  requireBookAuthor(request);
  if (data.action === "settings") {
    const { slug, title, author, introduction, price_minor } = data.settings;
    await sql`UPDATE book_settings SET slug = ${slug}, title = ${title}, author = ${author}, introduction = ${introduction}, price_minor=${price_minor} WHERE singleton = true;`;
    return { slug };
  }
  if (data.action === "createChapter") {
    const token = await hashTopicToken(randomBytes(32).toString("hex"));
    return sql.begin(async (tx) => {
      // Serializes chapter numbering with other author operations.
      await tx`SELECT singleton FROM book_settings WHERE singleton = true FOR UPDATE;`;
      const topics = await tx<{ id: string }>`
        INSERT INTO topics (name, token, locked) VALUES (${data.slug}, ${token}, false)
        ON CONFLICT (name) DO NOTHING RETURNING id;
      `;
      if (!topics[0])
        throw new Error(
          "That URL name is already in use. Choose another name.",
        );
      const rows = await tx<{ id: string }>`
        INSERT INTO chapters (topic_id, title, position, published, free)
        VALUES (${topics[0].id}, ${data.title}, (SELECT COALESCE(MAX(position), 0) + 1 FROM chapters), false, NOT EXISTS(SELECT 1 FROM chapters))
        RETURNING id;
      `;
      return { chapterId: rows[0].id };
    });
  }
  if (data.action === "saveDraft") {
    const rows = await sql<{ revision: number }>`
      UPDATE chapter_drafts SET draft = ${data.draft}::jsonb,
        revision = revision + 1, updated_at = NOW()
      WHERE chapter_id = ${data.chapterId} AND revision = ${data.revision}
      RETURNING revision;
    `;
    if (!rows[0])
      throw new Error(
        "This draft changed in another tab. Copy your text before reloading.",
      );
    return { revision: rows[0].revision };
  }
  return sql.begin(async (tx) => {
    const rows = await tx<{
      draft: unknown;
      revision: number;
      topic_id: string;
      locked: boolean;
      base_hash: string | null;
      current_hash: string;
    }>`
      SELECT d.draft, d.revision, c.topic_id, t.locked, d.base_hash, (SELECT md5(COALESCE(string_agg(p.id::text || p.perspective,'' ORDER BY p.id),'')) FROM perspectives p WHERE p.topic_id=c.topic_id AND p.parent_perspective_id IS NULL) AS current_hash FROM chapter_drafts d
      JOIN chapters c ON c.id = d.chapter_id JOIN topics t ON t.id = c.topic_id
      WHERE d.chapter_id = ${data.chapterId} FOR UPDATE OF d, c, t;
    `;
    const row = rows[0];
    if (!row || row.revision !== data.revision)
      throw new Error("Save and reload the latest draft before publishing.");
    if (row.base_hash && row.base_hash !== row.current_hash)
      throw new Error(
        "Published text changed elsewhere. Copy your draft and reconcile changes before publishing.",
      );
    if (row.locked)
      throw new Error("Encrypted topics cannot be published as book chapters.");
    const draft = bookDraftSchema.parse(
      typeof row.draft === "string" ? JSON.parse(row.draft) : row.draft,
    );
    if (!draft.perspectives.some((item) => item.text.trim()))
      throw new Error("Write a perspective before publishing.");
    const published = await tx<{
      id: string;
    }>`SELECT id FROM perspectives WHERE topic_id = ${row.topic_id} AND parent_perspective_id IS NULL;`;
    if (
      published.some((p) =>
        draft.perspectives.some((d) => d.id === p.id && !d.text.trim()),
      )
    )
      throw new Error(
        "Published perspectives cannot be blanked. Edit their text instead.",
      );
    const ids = new Set(draft.perspectives.map((item) => item.id));
    if (published.some((item) => !ids.has(item.id))) {
      throw new Error(
        "Published perspectives changed elsewhere. Reload and reconcile them before publishing.",
      );
    }
    for (const perspective of draft.perspectives) {
      if (!perspective.text.trim()) continue;
      const saved = await tx<{ id: string }>`
        INSERT INTO perspectives (id, topic_id, perspective)
        VALUES (${perspective.id}, ${row.topic_id}, ${perspective.text})
        ON CONFLICT (id) DO UPDATE SET perspective = EXCLUDED.perspective,
          rendered_html = CASE WHEN perspectives.perspective IS DISTINCT FROM EXCLUDED.perspective THEN NULL ELSE perspectives.rendered_html END, words_json = CASE WHEN perspectives.perspective IS DISTINCT FROM EXCLUDED.perspective THEN NULL ELSE perspectives.words_json END, updated_at = NOW()
        WHERE perspectives.topic_id = EXCLUDED.topic_id
        RETURNING id;
      `;
      if (!saved[0])
        throw new Error("A perspective belongs to another chapter.");
    }
    await tx`UPDATE chapters SET title = ${draft.title}, position = ${draft.position}, free=${draft.free}, perspective_order=${
      "{" +
      draft.perspectives
        .filter((x) => x.text.trim())
        .map((x) => x.id)
        .join(",") +
      "}"
    }::uuid[], published = true, updated_at = NOW() WHERE id = ${data.chapterId};`;
    // Invalidate drafts open in other tabs as well as repeated publish requests.
    await tx`UPDATE chapter_drafts SET revision = revision + 1, base_hash=(SELECT md5(COALESCE(string_agg(p.id::text || p.perspective,'' ORDER BY p.id),'')) FROM perspectives p WHERE p.topic_id=${row.topic_id} AND p.parent_perspective_id IS NULL), updated_at = NOW() WHERE chapter_id = ${data.chapterId};`;
    return { revision: row.revision + 1 };
  });
};
