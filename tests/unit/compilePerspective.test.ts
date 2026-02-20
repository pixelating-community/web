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

  it("preserves safe Bandcamp embed iframes", () => {
    const compiled = compilePerspective(
      '<iframe style="border: 0; width: 400px; height: 42px;" src="https://bandcamp.com/EmbeddedPlayer/album=2937215514/size=small/bgcol=ffffff/linkcol=7137dc/artwork=none/track=1717290234/transparent=true/" seamless><a href="https://k7records.bandcamp.com/album/dj-kicks-theo-parrish">DJ-Kicks: Theo Parrish by Jon Dixon</a></iframe>',
    );

    expect(compiled.renderedHtml).toContain("<iframe ");
    expect(compiled.renderedHtml).toContain('src="https://bandcamp.com/EmbeddedPlayer/');
    expect(compiled.renderedHtml).toContain('loading="lazy"');
    expect(compiled.renderedHtml).toContain('rel="noopener noreferrer"');
  });

  it("strips dangerous raw html", () => {
    const compiled = compilePerspective(
      '<script>alert(1)</script><img src="https://example.com/x.png" onerror="alert(2)" />',
    );

    expect(compiled.renderedHtml).not.toContain("<script");
    expect(compiled.renderedHtml).not.toContain("onerror=");
  });

  it("falls back to iframe body content for unsafe iframe sources", () => {
    const compiled = compilePerspective(
      '<iframe src="https://example.com/embed"><a href="https://example.com/embed">listen</a></iframe>',
    );

    expect(compiled.renderedHtml).not.toContain("<iframe");
    expect(compiled.renderedHtml).toContain(">listen</a>");
  });
});
