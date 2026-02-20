import { describe, expect, it } from "vitest";
import { extractWords, tokenizePerspective } from "@/lib/tokenizePerspective";

describe("tokenizePerspective", () => {
  it("keeps emoji and symbol tokens markable when space-delimited", () => {
    const tokens = tokenizePerspective("alpha 😀 ★ beta");
    const words = extractWords(tokens);
    expect(words).toEqual(["alpha", "😀", "★", "beta"]);
  });

  it("keeps punctuation/symbol tokens when they are standalone", () => {
    const tokens = tokenizePerspective("one - two ? three");
    const words = extractWords(tokens);
    expect(words).toEqual(["one", "-", "two", "?", "three"]);
  });

  it("ignores html comment tokens in markdown", () => {
    const tokens = tokenizePerspective("one <!-- secret --> two");
    const words = extractWords(tokens);
    expect(words).toEqual(["one", "two"]);
  });

  it("ignores multiline html comments", () => {
    const tokens = tokenizePerspective("one <!-- secret\nhidden --> two");
    const words = extractWords(tokens);
    expect(words).toEqual(["one", "two"]);
  });
});
