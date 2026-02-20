import { describe, expect, it } from "vitest";
import {
  applyKaraokeStyleSuggestion,
  getKaraokePhrasesFromSymbols,
  getKaraokeStyleSuggestions,
  getKaraokeWordInlineStyle,
  normalizeSymbolList,
  sanitizeWordClasses,
  setKaraokePhrasesInSymbols,
} from "@/lib/karaokePhrases";

describe("karaoke phrase symbols", () => {
  it("hydrates karaoke phrases from css symbols", () => {
    expect(
      getKaraokePhrasesFromSymbols([
        {
          content: "karaoke-phrase",
          type: "css",
          timestamp: 0,
          wordIndex: 2,
          cell: 4,
          track: 1,
          style: "text-4xl font-black not-allowed",
        },
      ]),
    ).toEqual([
      {
        startIndex: 2,
        endIndex: 4,
        colorIndex: 1,
        classes: ["text-4xl", "font-black"],
      },
    ]);
  });

  it("hydrates karaoke phrases from database JSON strings", () => {
    const symbols = JSON.stringify([
      {
        cell: 2,
        content: "karaoke-phrase",
        style: "text-8xl",
        timestamp: 0,
        track: 0,
        type: "css",
        wordIndex: 2,
      },
    ]);

    expect(getKaraokePhrasesFromSymbols(symbols)).toEqual([
      {
        startIndex: 2,
        endIndex: 2,
        colorIndex: 0,
        classes: ["text-8xl"],
      },
    ]);
  });

  it("replaces only karaoke phrase symbols", () => {
    expect(
      setKaraokePhrasesInSymbols(
        [
          { content: "keep", type: "emoji", timestamp: 1 },
          {
            content: "karaoke-phrase",
            type: "css",
            timestamp: 0,
            wordIndex: 0,
            cell: 0,
            track: 0,
          },
        ],
        [
          {
            startIndex: 3,
            endIndex: 3,
            colorIndex: 2,
            classes: ["text-pink-300"],
          },
        ],
      ),
    ).toEqual([
      { content: "keep", type: "emoji", timestamp: 1 },
      {
        cell: 3,
        content: "karaoke-phrase",
        style: "text-pink-300",
        timestamp: 0,
        track: 2,
        type: "css",
        wordIndex: 3,
      },
    ]);
  });

  it("preserves non-karaoke symbols from database JSON strings", () => {
    expect(
      setKaraokePhrasesInSymbols(
        JSON.stringify([
          { content: "keep", type: "emoji", timestamp: 1 },
          {
            content: "karaoke-phrase",
            type: "css",
            timestamp: 0,
            wordIndex: 0,
            cell: 0,
            track: 0,
          },
        ]),
        [
          {
            startIndex: 3,
            endIndex: 3,
            colorIndex: 2,
            classes: ["text-pink-300"],
          },
        ],
      ),
    ).toEqual([
      { content: "keep", type: "emoji", timestamp: 1 },
      {
        cell: 3,
        content: "karaoke-phrase",
        style: "text-pink-300",
        timestamp: 0,
        track: 2,
        type: "css",
        wordIndex: 3,
      },
    ]);
  });

  it("normalizes database JSON strings into symbol arrays", () => {
    expect(
      normalizeSymbolList(
        JSON.stringify([{ content: "keep", type: "emoji", timestamp: 1 }]),
      ),
    ).toEqual([{ content: "keep", type: "emoji", timestamp: 1 }]);
  });

  it("normalizes important utility tokens and resolves inline styles", () => {
    const classes = sanitizeWordClasses("!text-5xl !font-black text-pink-300 opacity-100");

    expect(classes).toEqual([
      "text-5xl",
      "font-black",
      "text-pink-300",
      "opacity-100",
    ]);
    expect(getKaraokeWordInlineStyle(classes)).toEqual({
      color: "var(--color-pink-300)",
      fontSize: "3rem",
      fontWeight: 900,
      lineHeight: "1",
      opacity: 1,
    });
  });

  it("suggests and completes the current style token", () => {
    expect(getKaraokeStyleSuggestions("text-8xl font-").slice(0, 3)).toEqual([
      "font-thin",
      "font-light",
      "font-normal",
    ]);

    expect(applyKaraokeStyleSuggestion("text-8xl font-", "font-black")).toBe(
      "text-8xl font-black ",
    );
    expect(applyKaraokeStyleSuggestion("!text-", "text-5xl")).toBe("!text-5xl ");
  });
});
