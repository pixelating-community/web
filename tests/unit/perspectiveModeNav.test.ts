import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("perspective mode nav", () => {
  it("renders only alternate destinations instead of linking to the current mode", () => {
    const source = readSource("src/components/PerspectiveModeNav.tsx");
    expect(source).toMatch(/import \{ Link \} from "@tanstack\/react-router";/);
    expect(source).toMatch(/showViewMode = true/);
    expect(source).toMatch(/if \(showViewMode\) \{/);
    expect(source).toMatch(
      /const availableItems = items\.filter\(\(item\) => item\.key !== currentMode\);/,
    );
    expect(source).toMatch(/if \(availableItems\.length === 0\) return null;/);
    expect(source).toMatch(/\{availableItems\.map\(\(item\) => \(/);
    expect(source).toMatch(/<Link/);
    expect(source).toMatch(/to=\{item\.href\}/);
    expect(source).toMatch(/preload="intent"/);
    expect(source).not.toMatch(/aria-current=/);
  });
});
