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
    expect(readSource("src/components/Perspectives.tsx")).toMatch(
      /\bw-screen\b/,
    );
  });

  it("uses a single stable scrollbar gutter on the root document", () => {
    expect(readSource("src/styles/globals.css")).toMatch(
      /scrollbar-gutter:\s*stable;/,
    );
    expect(readSource("src/styles/globals.css")).not.toMatch(
      /scrollbar-gutter:\s*stable both-edges;/,
    );
  });
});
