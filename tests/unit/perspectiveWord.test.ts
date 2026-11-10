import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, verifyAction, verifyToken } = vi.hoisted(() => ({
  query: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  verifyAction:
    vi.fn<() => { topicId: string; perspectiveId?: string } | null>(),
  verifyToken: vi.fn<() => Promise<boolean>>(),
}));
vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/db.server", () => ({
  sql: { begin: (callback: (tx: typeof query) => unknown) => callback(query) },
}));
vi.mock("@/lib/actionToken.server", () => ({
  verifyActionToken: verifyAction,
}));
vi.mock("@/lib/topicToken", () => ({ verifyTopicToken: verifyToken }));
vi.mock("@/lib/topicTokenCookies", () => ({
  resolveTopicTokenFromRequest: () => "test-key",
}));

import { updatePerspectiveWordServer } from "@/lib/perspectiveWord.server";
const data = {
  actionToken: "action",
  topicId: "11111111-1111-4111-8111-111111111111",
  perspectiveId: "22222222-2222-4222-8222-222222222222",
  index: 1,
  expectedWord: "go",
  word: "stay",
};
const request = new Request("https://example.test/t/example");
const timings = [
  { start: 1, end: 1, word: "go" },
  { start: 2, end: 2.9, word: "go" },
  null,
];
beforeEach(() => {
  vi.clearAllMocks();
  query.mockReset();
  verifyAction.mockReturnValue({ topicId: data.topicId });
  verifyToken.mockResolvedValue(true);
  query
    .mockResolvedValueOnce([
      {
        perspective: "go go\nnow",
        words_json: JSON.stringify(timings),
        name: "example",
        token: "stored-key",
        locked: false,
      },
    ])
    .mockResolvedValueOnce([]);
});
describe("saving one word", () => {
  it("preserves every timing boundary, null entry, and line break", async () => {
    const result = await updatePerspectiveWordServer({ request, data });
    expect(result).toMatchObject({
      ok: true,
      data: {
        perspective: "go stay\nnow",
        wordTimings: [timings[0], { ...timings[1], word: "stay" }, null],
      },
    });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it("rejects missing authorization before reading or writing data", async () => {
    verifyAction.mockReturnValue(null);
    expect(await updatePerspectiveWordServer({ request, data })).toMatchObject({
      ok: false,
    });
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects a wrong topic key without writing", async () => {
    verifyToken.mockResolvedValue(false);
    expect(await updatePerspectiveWordServer({ request, data })).toMatchObject({
      ok: false,
      error: "Topic is locked",
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("rejects a stale word without writing", async () => {
    expect(
      await updatePerspectiveWordServer({
        request,
        data: { ...data, expectedWord: "different" },
      }),
    ).toMatchObject({ ok: false });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
