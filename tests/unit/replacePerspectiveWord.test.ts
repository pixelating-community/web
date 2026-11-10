import { describe, expect, it } from "vitest";
import { replacePerspectiveWord } from "@/lib/replacePerspectiveWord";
import { perspectiveRuntimeReducer } from "@/components/sw/runtime";

describe("replacing a selected word", () => {
  it("keeps unsaved timing edits when a word save completes", () => {
    const state = {
      example: {
        dirtyTimings: true,
        timingsRevision: 2,
        timings: [{ start: 5, end: 6, word: "go" }],
      },
    };
    expect(
      perspectiveRuntimeReducer(state, {
        type: "replaceWord",
        id: "example",
        index: 0,
        word: "stay",
      }).example,
    ).toEqual({
      ...state.example,
      timings: [{ start: 5, end: 6, word: "stay" }],
    });
  });
  it("replaces the selected occurrence among repeated words and preserves line breaks", () => {
    const result = replacePerspectiveWord({
      text: "go go\nnow go",
      index: 1,
      expectedWord: "go",
      word: "stay",
    });
    expect(result.text).toBe("go stay\nnow go");
    expect(result.words).toEqual(["go", "stay", "now", "go"]);
  });
  it("does not replace a substring in an earlier word", () => {
    expect(
      replacePerspectiveWord({
        text: "gopher go",
        index: 1,
        expectedWord: "go",
        word: "stay",
      }).text,
    ).toBe("gopher stay");
  });
  it("allows a plus sign as a word", () => {
    expect(
      replacePerspectiveWord({
        text: "red and blue",
        index: 1,
        expectedWord: "and",
        word: "+",
      }).words,
    ).toEqual(["red", "+", "blue"]);
  });
  it("rejects a stale selection or an edit that changes word count", () => {
    expect(() =>
      replacePerspectiveWord({
        text: "hello world",
        index: 1,
        expectedWord: "there",
        word: "you",
      }),
    ).toThrow(/changed elsewhere/);
    for (const word of ["", "two words", "two\nwords"]) {
      expect(() =>
        replacePerspectiveWord({
          text: "hello world",
          index: 1,
          expectedWord: "world",
          word,
        }),
      ).toThrow(/one word/);
    }
  });
});
