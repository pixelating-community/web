import { describe, expect, it } from "vitest";
import {
  getKaraokeLines,
  KARAOKE_MAX_WORDS_PER_LINE,
} from "@/lib/karaokeLines";

describe("karaokeLines", () => {
  it("uses rendered markdown text for karaoke words", () => {
    expect(
      getKaraokeLines({
        perspective: "I was **hoping** you co",
        rendered_html: "<p>I was <strong>hoping</strong> you co</p>",
      }),
    ).toEqual([
      [
        { index: 0, word: "I" },
        { index: 1, word: "was" },
        { index: 2, word: "hoping" },
        { index: 3, word: "you" },
        { index: 4, word: "co" },
      ],
    ]);
  });

  it("keeps block boundaries while preserving rendered word indexes", () => {
    expect(
      getKaraokeLines({
        perspective: "# Hello\n\n- bright day",
        rendered_html: "<h1>Hello</h1><ul><li>bright day</li></ul>",
      }),
    ).toEqual([
      [{ index: 0, word: "Hello" }],
      [
        { index: 1, word: "bright" },
        { index: 2, word: "day" },
      ],
    ]);
  });

  it("breaks long prose blocks into bounded lines without losing words", () => {
    const words = Array.from(
      { length: KARAOKE_MAX_WORDS_PER_LINE * 2 + 5 },
      (_, index) => `word-${index}`,
    );
    const lines = getKaraokeLines({
      perspective: words.join(" "),
      rendered_html: `<p>${words.join(" ")}</p>`,
    });

    expect(lines.map((line) => line.length)).toEqual([
      KARAOKE_MAX_WORDS_PER_LINE,
      KARAOKE_MAX_WORDS_PER_LINE,
      5,
    ]);
    expect(lines.flat()).toEqual(
      words.map((word, index) => ({ index, word })),
    );
  });
});
