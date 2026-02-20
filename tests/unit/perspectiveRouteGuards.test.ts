import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("perspective route guards", () => {
  it("keeps an Outlet render path in /p/$id for child routes", () => {
    const source = readSource("src/routes/p.$id.tsx");
    expect(source).toMatch(/return\s*<Outlet\s*\/>/);
  });

  it("uses router-level navigate in /p/$id/commit to avoid stale from-match warnings", () => {
    const source = readSource("src/routes/p.$id.commit.tsx");
    expect(source).toMatch(/import\s+\{\s*createFileRoute,\s*useRouter\s*\}/);
    expect(source).toMatch(/const\s+router\s*=\s*useRouter\(\)/);
    expect(source).toMatch(/router\.navigate\(/);
  });

  it("keeps SW recording flow on the same route without commit jumps", () => {
    const source = readSource("src/components/sw/useSwRecording.ts");
    expect(source).toMatch(/\/api\/obj\/upload/);
    expect(source).not.toMatch(/\/commit\?/);
  });
});
