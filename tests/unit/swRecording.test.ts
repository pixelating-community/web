import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildPersistedAudioPatch } from "@/components/sw/useSwRecording";

const readSource = (relativePath: string) =>
  readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("buildPersistedAudioPatch", () => {
  it("clears local preview blobs once a managed audio key is persisted", () => {
    expect(buildPersistedAudioPatch("recordings/fixed.m4a")).toEqual({
      localAudioOverride: undefined,
      audioOverride: "recordings/fixed.m4a",
      audioKeyOverride: "recordings/fixed.m4a",
    });
  });

  it("does not treat absolute playback URLs as managed keys", () => {
    expect(buildPersistedAudioPatch("https://cdn.example.test/audio/fixed.m4a"))
      .toEqual({
        localAudioOverride: undefined,
        audioOverride: "https://cdn.example.test/audio/fixed.m4a",
        audioKeyOverride: undefined,
      });
  });

  it("refreshes cached topic data before a successful timing save returns", () => {
    const source = readSource("src/components/sw/useSwRecording.ts");

    expect(source).toMatch(
      /await queryClient\.invalidateQueries\(\{\s*queryKey: \["topic-payload"\],\s*\}\);\s*return result\.data/,
    );
  });
});
