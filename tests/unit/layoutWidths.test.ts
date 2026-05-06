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
    expect(source).toMatch(/<PerspectiveReflections/);
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
