import { describe, expect, it } from "vitest";
import {
  buildClearAllMarkTimings,
  buildMarkAndForwardState,
  buildTimingEndEntry,
  buildTimingStartEntry,
  buildUndoLastMarkState,
  getTimingEditorIndex,
} from "@/components/sw/timingEditor";

describe("sw timing editor helpers", () => {
  it("keeps timing marks moving forward from the selected word", () => {
    expect(
      buildMarkAndForwardState({
        currentTime: 1.25,
        existingTimings: [null, { start: 2.5 }],
        selectedWordIndex: 0,
        wordsLength: 2,
      }),
    ).toEqual({
      nextSelectedWordIndex: 1,
      nextTimings: [{ start: 1.25, end: undefined }, { start: 2.5 }],
    });
  });

  it("keeps undo clearing the previous mark and rewinding to it", () => {
    expect(
      buildUndoLastMarkState({
        existingTimings: [{ start: 0.5 }, { start: 1.5 }],
        selectedWordIndex: 2,
        wordsLength: 3,
      }),
    ).toEqual({
      nextSelectedWordIndex: 1,
      nextTimings: [{ start: 0.5 }, null, null],
      seekTime: 1.5,
    });
  });

  it("keeps clear-all producing a null mark for every word", () => {
    expect(buildClearAllMarkTimings(3)).toEqual([null, null, null]);
    expect(
      getTimingEditorIndex({
        selectedWordIndex: undefined,
        wordsLength: 3,
      }),
    ).toBe(0);
  });

  it("keeps timing start/end edits enforcing a minimum word duration", () => {
    expect(
      buildTimingStartEntry({
        existing: { start: 1, end: 1.005 },
        start: 1.5,
      }),
    ).toEqual({
      start: 1.5,
      end: 1.54,
    });
    expect(
      buildTimingEndEntry({
        existing: null,
        end: 2,
      }),
    ).toEqual({
      start: 1.8,
      end: 2,
    });
  });
});
