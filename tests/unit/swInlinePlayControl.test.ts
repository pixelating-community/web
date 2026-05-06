import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("sw inline play control", () => {
  it("uses TanStack Link for internal mode switches", () => {
    const source = readSource("src/components/sw/SwInlinePlayControl.tsx");
    expect(source).toMatch(/import \{ Link \} from "@tanstack\/react-router";/);
    expect(source).toMatch(/to=\{previewHref\}/);
    expect(source).toMatch(/to=\{writeHref\}/);
    expect(source).toMatch(/to=\{recordHref\}/);
    expect(source).toMatch(/preload="intent"/);
  });

  it("keeps the inline play control visible on studio editor routes with the mode nav", () => {
    const source = readSource("src/components/SW.tsx");
    expect(source).toMatch(
      /isStudioSurface &&[\s\S]*topicName &&[\s\S]*isActive/,
    );
    expect(source).not.toMatch(/!showPerspectiveModeNav &&[\s\S]*isActive/);
  });

  it("keeps edit actions visible for text-only viewer perspectives", () => {
    const source = readSource("src/components/SW.tsx");

    expect(source).toMatch(/const showViewerEditActions =/);
    expect(source).toMatch(/hasAudio \|\| showViewerEditActions/);
    expect(source).toMatch(
      /previewHref=\{isStudioSurface \|\| !hasAudio \? "" : previewHref\}/,
    );
  });
});
