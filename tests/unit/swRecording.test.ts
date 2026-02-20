import { describe, expect, it } from "vitest";
import { buildPersistedAudioPatch } from "@/components/sw/useSwRecording";

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
});
