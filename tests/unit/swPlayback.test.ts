import { describe, expect, it } from "vitest";
import { normalizeTimings } from "@/lib/perspectiveTimings";
import {
  findActiveWordIndex,
  getTimingDuration,
  normalizePlaybackTimings,
} from "@/lib/swPlayback";
import type { WordTimingEntry } from "@/types/perspectives";

describe("normalizeTimings", () => {
  it("parses legacy JSON string payloads", () => {
    const input = JSON.stringify([
      { start_time: "1.48", end_time: "2.06", word: "To" },
      { timestamp: "2.17", stop: "2.55", word: "Earlier" },
    ]);

    expect(normalizeTimings(input)).toEqual([
      { start: 1.48, end: 2.06, word: "To" },
      { start: 2.17, end: 2.55, word: "Earlier" },
    ]);
  });
});

describe("sw playback timing helpers", () => {
  it("normalizes duplicate and backward starts into increasing order", () => {
    const timings: WordTimingEntry[] = [
      { start: 1.2 },
      { start: 1.2 },
      { start: 1.1 },
      { start: 1.5 },
    ];

    const normalized = normalizePlaybackTimings(timings);
    expect(normalized[0]?.start).toBe(1.2);
    expect(normalized[1]?.start).toBeGreaterThan(normalized[0]?.start ?? 0);
    expect(normalized[2]?.start).toBeGreaterThan(normalized[1]?.start ?? 0);
    expect(normalized[3]?.start).toBeGreaterThan(normalized[2]?.start ?? 0);
  });

  it("advances active word across duplicate starts after normalization", () => {
    const timings: WordTimingEntry[] = normalizePlaybackTimings([
      { start: 2.0 },
      { start: 2.0 },
      { start: 2.0 },
      { start: 2.5 },
    ]);

    expect(findActiveWordIndex(timings, 2.0)).toBe(0);
    expect(findActiveWordIndex(timings, 2.01)).toBe(1);
    expect(findActiveWordIndex(timings, 2.02)).toBe(2);
    expect(findActiveWordIndex(timings, 2.5)).toBe(3);
  });

  it("uses next word start to derive duration when end is missing", () => {
    const timings: WordTimingEntry[] = normalizePlaybackTimings([
      { start: 1.0 },
      { start: 1.3 },
    ]);
    expect(getTimingDuration(timings, 0)).toBeCloseTo(0.3, 4);
  });

  it("treats invalid end values as missing and falls back to next start", () => {
    const timings: WordTimingEntry[] = normalizePlaybackTimings([
      { start: 1.0, end: 0.1 },
      { start: 1.4 },
      { start: 1.9 },
    ]);

    expect(getTimingDuration(timings, 0)).toBeCloseTo(0.4, 4);
    expect(findActiveWordIndex(timings, 1.35)).toBe(0);
    expect(findActiveWordIndex(timings, 1.45)).toBe(1);
  });

  it("does not keep highlighting after a marked word window ends", () => {
    const timings: WordTimingEntry[] = normalizePlaybackTimings([
      { start: 1.0, end: 1.2 },
      { start: 1.6, end: 1.8 },
    ]);

    expect(findActiveWordIndex(timings, 1.3)).toBe(-1);
    expect(findActiveWordIndex(timings, 1.55)).toBe(-1);
    expect(findActiveWordIndex(timings, 1.7)).toBe(1);
    expect(findActiveWordIndex(timings, 9)).toBe(-1);
  });

  it("does not bridge highlight across unmarked words", () => {
    const timings: WordTimingEntry[] = normalizePlaybackTimings([
      { start: 1.0 },
      null,
      { start: 2.0 },
    ]);

    expect(findActiveWordIndex(timings, 1.05)).toBe(0);
    expect(findActiveWordIndex(timings, 1.4)).toBe(-1);
    expect(findActiveWordIndex(timings, 2.05)).toBe(2);
  });

  it("never highlights when no words are marked", () => {
    const timings: WordTimingEntry[] = normalizePlaybackTimings([null, null]);
    expect(findActiveWordIndex(timings, 0.2)).toBe(-1);
    expect(findActiveWordIndex(timings, 12)).toBe(-1);
  });
});
