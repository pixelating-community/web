import { beforeEach, describe, expect, it, vi } from "vitest";

const { encryptMock, sqlMock, verifyTopicTokenMock, buildServerAudioUrlMock } =
  vi.hoisted(() => ({
    encryptMock: vi.fn((value: string) => `enc:${value}`),
    sqlMock: vi.fn(),
    verifyTopicTokenMock: vi.fn(),
    buildServerAudioUrlMock: vi.fn(
      (key: string) => `https://obj.pixelat.ing/${key}`,
    ),
  }));

vi.mock("@/lib/crypto", () => ({
  encrypt: encryptMock,
}));

vi.mock("@/lib/db", () => ({
  sql: sqlMock,
}));

vi.mock("@/lib/topicToken", () => ({
  verifyTopicToken: verifyTopicTokenMock,
}));

vi.mock("@/lib/publicAudioBase", () => ({
  buildServerAudioUrl: buildServerAudioUrlMock,
  getServerAudioBaseUrl: () => "https://obj.pixelat.ing",
}));

import {
  savePerspectiveTimings,
  type TimingsError,
} from "@/lib/perspectiveTimings";
import type { WordTimingEntry } from "@/types/perspectives";

describe("savePerspectiveTimings", () => {
  beforeEach(() => {
    encryptMock.mockClear();
    sqlMock.mockReset();
    verifyTopicTokenMock.mockReset();
    buildServerAudioUrlMock.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("persists audio-only recordings without requiring timings", async () => {
    const row = {
      audio_src: "old-audio-key",
      end_time: 4.2,
      id: "p1",
      locked: false,
      name: "art",
      start_time: 1.1,
      token: "$argon2id$hash",
      topic_id: "topic-1",
    };
    verifyTopicTokenMock.mockResolvedValueOnce(true);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 200,
      } as Response,
    );
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.id")) return [row];
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    const result = await savePerspectiveTimings({
      perspectiveId: "p1",
      timings: [null, null] satisfies WordTimingEntry[],
      audioSrc: "new-audio-key",
      duration: 9.5,
      token: "writer-token",
    });

    expect(result).toEqual({
      timings: [],
      audio_src: "new-audio-key",
      start_time: 0,
      end_time: 9.5,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual([null, "new-audio-key", 0, 9.5, "p1"]);
    expect(encryptMock).not.toHaveBeenCalled();
    expect(verifyTopicTokenMock).toHaveBeenCalledWith(
      "writer-token",
      "$argon2id$hash",
    );
    expect(buildServerAudioUrlMock).toHaveBeenCalledWith("new-audio-key");
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("keeps existing bounds when no timings and no duration are provided", async () => {
    const row = {
      audio_src: "stored-audio",
      end_time: 12.25,
      id: "p2",
      locked: false,
      name: "art",
      start_time: 2.5,
      token: "$argon2id$hash",
      topic_id: "topic-2",
    };
    verifyTopicTokenMock.mockResolvedValueOnce(true);
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.id")) return [row];
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    const result = await savePerspectiveTimings({
      perspectiveId: "p2",
      timings: [],
      token: "writer-token",
    });

    expect(result).toEqual({
      timings: [],
      audio_src: "stored-audio",
      start_time: 2.5,
      end_time: 12.25,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual([null, "stored-audio", 2.5, 12.25, "p2"]);
    expect(verifyTopicTokenMock).toHaveBeenCalledWith(
      "writer-token",
      "$argon2id$hash",
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects missing managed audio keys before persisting", async () => {
    const row = {
      audio_src: null,
      end_time: null,
      id: "p3",
      locked: false,
      name: "art",
      start_time: null,
      token: "$argon2id$hash",
      topic_id: "topic-3",
    };
    verifyTopicTokenMock.mockResolvedValueOnce(true);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        status: 404,
      } as Response,
    );
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.id")) return [row];
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    await expect(
      savePerspectiveTimings({
        perspectiveId: "p3",
        timings: [],
        audioSrc: "missing-audio-key.wav",
        token: "writer-token",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_AUDIO_SRC",
    } satisfies Pick<TimingsError, "code">);

    expect(updates).toHaveLength(0);
    expect(buildServerAudioUrlMock).toHaveBeenCalledWith(
      "missing-audio-key.wav",
    );
  });
});
