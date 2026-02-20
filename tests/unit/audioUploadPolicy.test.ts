import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("audio upload policy", () => {
  it("routes sw recording uploads through multipart server handling", () => {
    const source = readSource("src/components/sw/useSwRecording.ts");
    expect(source).toMatch(/new FormData\(\)/);
    expect(source).toMatch(/fetch\("\/api\/obj\/upload"/);
    expect(source).not.toMatch(/uploadUrl/);
  });

  it("routes commit uploads through multipart server handling", () => {
    const source = readSource("src/routes/p.$id.commit.tsx");
    expect(source).toMatch(/new FormData\(\)/);
    expect(source).toMatch(/fetch\("\/api\/obj\/upload"/);
    expect(source).not.toMatch(/uploadUrl/);
  });

  it("keeps multipart audio uploads on canonical m4a transcode", () => {
    const source = readSource("src/routes/api/obj/upload.ts");
    expect(source).toMatch(/transcodeAudioFileToM4a/);
    expect(source).toMatch(/CANONICAL_AUDIO_CONTENT_TYPE/);
  });
});
