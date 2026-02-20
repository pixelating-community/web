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

  it("does not show the inline preview shortcut when the mode nav is already visible", () => {
    const source = readSource("src/components/SW.tsx");
    expect(source).toMatch(/isStudioSurface && topicName && !showPerspectiveModeNav/);
  });
});
