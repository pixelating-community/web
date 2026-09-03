import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("layout widths", () => {
  it("keeps viewport-width containers on primary horizontal surfaces", () => {
    expect(readSource("src/components/SW.tsx")).toMatch(/\bw-screen\b/);
    expect(readSource("src/components/WritePerspective.tsx")).toMatch(
      /\bw-screen\b/,
    );
    expect(readSource("src/components/PerspectiveListener.tsx")).toMatch(
      /\bw-screen\b/,
    );
  });

  it("keeps the listener player clipped to one viewport before reflections", () => {
    const source = readSource("src/components/PerspectiveListener.tsx");

    expect(source).toMatch(
      /className="relative flex h-dvh w-full flex-col overflow-y-auto"/,
    );
    expect(source).toMatch(
      /className="relative z-10 flex h-dvh w-full shrink-0 flex-col overflow-hidden"/,
    );
    expect(source).toMatch(
      /className="relative z-10 flex w-screen flex-1 min-h-0 items-center justify-center overflow-hidden/,
    );
    expect(source).toMatch(
      /className="h-full w-\[80vw\] overflow-y-auto scrollbar-transparent"/,
    );
    expect(source).toMatch(
      /<PerspectiveSupport perspective=\{perspective\} \/>\s*<\/div>\s*<PerspectiveReflections/,
    );
    expect(source).toMatch(/<PerspectiveReflections/);
    expect(source).toMatch(
      /aria-label="Add reflection"[\s\S]*?<span aria-hidden="true">💭<\/span>/,
    );
    expect(source).not.toMatch(/⊕ Add reflection/);
  });

  it("uses a single stable scrollbar gutter on the root document", () => {
    expect(readSource("src/styles/globals.css")).toMatch(
      /scrollbar-gutter:\s*stable;/,
    );
    expect(readSource("src/styles/globals.css")).not.toMatch(
      /scrollbar-gutter:\s*stable both-edges;/,
    );
  });

  it("keeps karaoke text descenders from being clipped", () => {
    const source = readSource("src/components/KaraokePresenter.tsx");
    const cssSource = readSource("src/styles/globals.css");

    expect(source).toMatch(/overflow-y-visible/);
    expect(source).toMatch(/leading-\[1\.18\]/);
    expect(cssSource).toMatch(/\.karaoke-view button\.sw-word\.karaoke-word/);
    expect(cssSource).toMatch(/padding-bottom: 0\.14em;/);
  });

  it("keeps support controls flat and currency-neutral", () => {
    const supportSource = readSource(
      "src/components/PerspectiveSupport.tsx",
    );
    const listenerSource = readSource(
      "src/components/PerspectiveListener.tsx",
    );
    const cssSource = readSource("src/styles/globals.css");

    expect(supportSource).toContain('<span aria-hidden="true">💰</span>');
    expect(supportSource).toContain('<span aria-hidden="true">ⅈ</span>');
    expect(supportSource).not.toContain("💸");
    expect(supportSource).not.toContain("ℹ️");
    expect(supportSource).not.toContain("pixel-ui-");
    expect(listenerSource).not.toContain("pixel-ui-");
    expect(cssSource).not.toContain(".pixel-ui-");
  });
});
