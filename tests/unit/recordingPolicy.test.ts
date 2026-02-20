import { describe, expect, it } from "vitest";
import { buildTimingsForRecordedAudio } from "@/components/sw/recordingPolicy";

describe("buildTimingsForRecordedAudio", () => {
  it("resets timings to null for each word", () => {
    const next = buildTimingsForRecordedAudio(["a", "b", "c"]);

    expect(next).toEqual([null, null, null]);
  });

  it("handles empty perspectives", () => {
    expect(buildTimingsForRecordedAudio([])).toEqual([]);
  });
});
