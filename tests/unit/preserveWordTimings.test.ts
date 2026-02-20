import { describe, expect, it } from "vitest";
import { preserveWordTimings } from "@/lib/preserveWordTimings";
import type { WordTimingEntry } from "@/types/perspectives";

describe("preserveWordTimings", () => {
  it("preserves timings for unchanged words when a new leading word is added", () => {
    const oldTimings: WordTimingEntry[] = [
      { start: 1, end: 1.2, word: "hello" },
      { start: 2, end: 2.4, word: "world" },
    ];

    const next = preserveWordTimings({
      oldTimings,
      oldWords: ["hello", "world"],
      newWords: ["new", "hello", "world"],
    });

    expect(next).toEqual([
      null,
      { start: 1, end: 1.2, word: "hello" },
      { start: 2, end: 2.4, word: "world" },
    ]);
  });

  it("preserves non-contiguous matches when words are deleted", () => {
    const oldTimings: WordTimingEntry[] = [
      { start: 0.1, word: "a" },
      { start: 0.2, word: "b" },
      { start: 0.3, word: "c" },
    ];

    const next = preserveWordTimings({
      oldTimings,
      oldWords: ["a", "b", "c"],
      newWords: ["a", "c"],
    });

    expect(next).toEqual([
      { start: 0.1, end: undefined, word: "a" },
      { start: 0.3, end: undefined, word: "c" },
    ]);
  });

  it("handles duplicate words while preserving order", () => {
    const oldTimings: WordTimingEntry[] = [
      { start: 1, word: "go" },
      { start: 2, word: "go" },
      { start: 3, word: "now" },
    ];

    const next = preserveWordTimings({
      oldTimings,
      oldWords: ["go", "go", "now"],
      newWords: ["go", "now"],
    });

    expect(next).toEqual([
      { start: 1, end: undefined, word: "go" },
      { start: 3, end: undefined, word: "now" },
    ]);
  });
});
