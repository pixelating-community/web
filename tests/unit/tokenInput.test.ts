import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("token input", () => {
  it("supports toggling token visibility", () => {
    const source = readSource("src/components/Token.tsx");
    expect(source).toMatch(/const \[showToken, setShowToken\] = useState\(false\);/);
    expect(source).toMatch(/type=\{showToken \? "text" : "password"\}/);
    expect(source).toMatch(/data-testid="toggle-token-visibility"/);
    expect(source).toMatch(/aria-label=\{showToken \? "Hide token" : "Show token"\}/);
  });

  it("uses modern password input attributes for token entry", () => {
    const source = readSource("src/components/Token.tsx");
    expect(source).toMatch(/autoComplete="current-password"/);
    expect(source).toMatch(/autoCapitalize="none"/);
    expect(source).toMatch(/autoCorrect="off"/);
    expect(source).toMatch(/spellCheck=\{false\}/);
    expect(source).toMatch(/enterKeyHint="done"/);
  });
});
