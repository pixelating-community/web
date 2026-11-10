import { beforeEach, describe, it, expect, vi } from "vitest";
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/db.server", () => ({ sql }));
import {
  buildBookAuthorCookie,
  isBookAuthor,
  verifyBookAuthorKey,
} from "@/lib/bookAuth.server";
import { canReadBookTopic } from "@/lib/bookAccess.server";
import { bookDraftSchema, bookSettingsSchema } from "@/lib/book.schema";
describe("book permissions", () => {
  beforeEach(() => {
    vi.stubEnv("BOOK_AUTHOR_KEY", "test-author-secret");
    sql.mockReset();
  });
  it("requires a signed, unexpired author cookie", () => {
    const now = Date.now();
    const cookie = buildBookAuthorCookie(false, now).split(";")[0];
    expect(
      isBookAuthor(
        new Request("https://site/book", { headers: { cookie } }),
        now,
      ),
    ).toBe(true);
    expect(
      isBookAuthor(
        new Request("https://site/book", { headers: { cookie: cookie + "x" } }),
        now,
      ),
    ).toBe(false);
    expect(
      isBookAuthor(
        new Request("https://site/book", { headers: { cookie } }),
        now + 43200001,
      ),
    ).toBe(false);
    expect(verifyBookAuthorKey("wrong")).toBe(false);
  });
  it("allows ordinary topics and published free chapters", async () => {
    sql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ published: true, free: true }]);
    expect(await canReadBookTopic("ordinary")).toBe(true);
    expect(await canReadBookTopic("free")).toBe(true);
  });
  it("denies drafts even when marked free and denies anonymous paid access", async () => {
    sql
      .mockResolvedValueOnce([{ published: false, free: true }])
      .mockResolvedValueOnce([{ published: true, free: false }]);
    expect(await canReadBookTopic("draft")).toBe(false);
    expect(await canReadBookTopic("paid")).toBe(false);
  });
  it("author access is independent of reader purchases", async () => {
    sql.mockResolvedValue([{ published: false, free: false }]);
    const cookie = buildBookAuthorCookie().split(";")[0];
    expect(
      await canReadBookTopic(
        "draft",
        new Request("https://site", { headers: { cookie } }),
      ),
    ).toBe(true);
  });
  it("grants a buyer access but rejects refunded or expired purchase sessions", async () => {
    const request = new Request("https://site", {
      headers: { cookie: "book_reader=opaque" },
    });
    sql
      .mockResolvedValueOnce([{ published: true, free: false }])
      .mockResolvedValueOnce([{ id: "reader" }])
      .mockResolvedValueOnce([{ id: "order" }]);
    expect(await canReadBookTopic("paid", request)).toBe(true);
    sql
      .mockResolvedValueOnce([{ published: true, free: false }])
      .mockResolvedValueOnce([{ id: "reader" }])
      .mockResolvedValueOnce([]);
    expect(await canReadBookTopic("paid", request)).toBe(false);
  });
  it("rejects duplicate perspective IDs and invalid prices or route names", () => {
    const p = { id: "019e0270-7c20-7000-8000-000000000001", text: "text" };
    expect(
      bookDraftSchema.safeParse({
        title: "Title",
        position: 1,
        free: false,
        perspectives: [p, p],
      }).success,
    ).toBe(false);
    expect(
      bookSettingsSchema.safeParse({
        title: "Book",
        slug: "api",
        author: "",
        introduction: "",
        price_minor: 100,
      }).success,
    ).toBe(false);
  });
});
