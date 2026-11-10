import { describe, expect, it } from "vitest";
import { resolveKaraokeLoop } from "@/lib/karaokeLoop";

describe("karaoke playback loops", () => {
  it("uses the requested start and end, including zero", () => {
    expect(resolveKaraokeLoop(9.64, 20.86)).toEqual({
      start: 9.64,
      end: 20.86,
    });
    expect(resolveKaraokeLoop(0, 2)).toEqual({ start: 0, end: 2 });
  });
  it("clamps the end to the media duration", () => {
    expect(resolveKaraokeLoop(9.64, 200, 184.529)).toEqual({
      start: 9.64,
      end: 184.529,
    });
  });
  it("does not create a loop for missing or invalid boundaries", () => {
    for (const [start, end, duration] of [
      [undefined, 10],
      [0, undefined],
      [4, 4],
      [5, 4],
      [-1, 4],
      [NaN, 4],
      [0, Infinity],
      [5, 8, 3],
    ]) {
      expect(resolveKaraokeLoop(start, end, duration)).toBeNull();
    }
  });
});
