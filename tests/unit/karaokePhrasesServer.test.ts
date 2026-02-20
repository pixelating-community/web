import { beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock, verifyActionTokenMock } = vi.hoisted(() => ({
  sqlMock: vi.fn<() => unknown>(),
  verifyActionTokenMock: vi.fn<() => unknown>(),
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));

vi.mock("@/lib/actionToken.server", () => ({
  verifyActionToken: verifyActionTokenMock,
}));

vi.mock("@/lib/db.server", () => ({
  sql: sqlMock,
}));

vi.mock("@/lib/requestId", () => ({
  getRequestId: () => "req-1",
}));

import { saveKaraokePhrasesServer } from "@/lib/karaokePhrases.server";

const request = new Request("https://we.pixelat.ing/t/art/ke/p1");

describe("saveKaraokePhrasesServer", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    verifyActionTokenMock.mockReset();
    verifyActionTokenMock.mockReturnValue(true);
  });

  it("verifies the action token and persists karaoke phrase symbols", async () => {
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT topic_id")) {
          return [
            {
              topic_id: "topic-1",
              symbols: [{ content: "keep", timestamp: 2, type: "emoji" }],
            },
          ];
        }
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    const result = await saveKaraokePhrasesServer({
      request,
      data: {
        actionToken: "align-token",
        perspectiveId: "p1",
        phrases: [
          {
            startIndex: 1,
            endIndex: 1,
            colorIndex: 3,
            classes: ["text-5xl", "unknown"],
          },
        ],
        topicId: "topic-1",
      },
    });

    expect(verifyActionTokenMock).toHaveBeenCalledWith({
      token: "align-token",
      requiredScope: "perspective:align",
      topicId: "topic-1",
    });
    expect(updates).toHaveLength(1);
    expect(JSON.parse(String(updates[0]?.[0]))).toEqual([
      { content: "keep", timestamp: 2, type: "emoji" },
      {
        cell: 1,
        content: "karaoke-phrase",
        style: "text-5xl",
        timestamp: 0,
        track: 3,
        type: "css",
        wordIndex: 1,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      phrases: [
        {
          startIndex: 1,
          endIndex: 1,
          colorIndex: 3,
          classes: ["text-5xl"],
        },
      ],
    });
  });
});
