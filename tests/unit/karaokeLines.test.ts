import { describe, expect, it } from "vitest";
import { getKaraokeLines } from "@/lib/karaokeLines";

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
});
