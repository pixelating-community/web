import { describe, expect, it } from "vitest";
import { compilePerspective } from "@/lib/compilePerspective";

describe("compilePerspective", () => {
  it("does not wrap words by default", () => {
    const compiled = compilePerspective("hello world");

    expect(compiled.words).toEqual(["hello", "world"]);
    expect(compiled.renderedHtml).not.toContain("sw-word");
    expect(compiled.renderedHtml).toContain("hello world");
  });

  it("wraps words when requested", () => {
    const compiled = compilePerspective("hello world", { wrapWords: true });

    expect(compiled.renderedHtml).toContain('class="sw-word"');
    expect(compiled.renderedHtml).toContain('data-word-index="0"');
    expect(compiled.renderedHtml).toContain('data-word-index="1"');
    expect(compiled.words).toEqual(["hello", "world"]);
  });
});
