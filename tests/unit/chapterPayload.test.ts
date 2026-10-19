import { beforeEach, describe, expect, it, vi } from "vitest";

const { sql, getTopicPayload, resolveTopicUnlock } = vi.hoisted(() => ({
  sql: vi.fn(),
  getTopicPayload: vi.fn(),
  resolveTopicUnlock: vi.fn(),
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/db.server", () => ({ sql }));
vi.mock("@/lib/getTopicPayload.server", () => ({ getTopicPayload }));
vi.mock("@/lib/topicUnlockRoute.server", () => ({
  resolveUnlockLoaderDataServer: resolveTopicUnlock,
}));

import { loadChapterPayloadServer } from "@/lib/chapterPayloadRoute.server";
import { resolveChapterUnlockLoaderDataServer } from "@/lib/chapterUnlockRoute.server";

const input = {
  topicName: "startsw",
  request: new Request("https://pxl8.ing/c/startsw"),
};

describe("chapter extension of a topic", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sql.mockResolvedValue([]);
  });

  it("does not expose a topic as a chapter without a chapter row", async () => {
    expect(await loadChapterPayloadServer(input)).toEqual({
      data: null,
      error: "chapter not found",
    });
    expect(getTopicPayload).not.toHaveBeenCalled();
  });

  it("reuses the linked topic payload and request permissions", async () => {
    sql.mockResolvedValue([{ id: "chapter-id", topic_id: "topic-id" }]);
    const payload = {
      data: { topic: { id: "topic-id", canWrite: false } },
      error: "",
    };
    getTopicPayload.mockResolvedValue(payload);
    expect(await loadChapterPayloadServer(input)).toBe(payload);
    expect(getTopicPayload).toHaveBeenCalledWith(input);
  });

  it("does not unlock a chapter that does not exist", async () => {
    expect(await resolveChapterUnlockLoaderDataServer(input)).toMatchObject({
      canAccess: false,
      canWrite: false,
      error: "chapter not found",
    });
    expect(resolveTopicUnlock).not.toHaveBeenCalled();
  });

  it("inherits unlock permissions only after resolving chapter membership", async () => {
    sql.mockResolvedValue([{ id: "chapter-id", topic_id: "topic-id" }]);
    const permissions = { canAccess: false, canWrite: false, error: "" };
    resolveTopicUnlock.mockResolvedValue(permissions);
    expect(await resolveChapterUnlockLoaderDataServer(input)).toBe(permissions);
    expect(resolveTopicUnlock).toHaveBeenCalledWith(input);
  });
});
