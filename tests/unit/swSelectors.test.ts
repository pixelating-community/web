import { describe, expect, it } from "vitest";
import {
  hasRuntimeAudioOverride,
  resolveSwAudioSource,
  selectAudioValueForSave,
  selectCurrentTrack,
  selectNextPlayablePerspective,
  selectPerspectiveAudioValue,
  selectPerspectiveTimings,
  selectPlaybackClock,
  selectPlaybackErrorSummary,
  selectPlayheadPercent,
  selectSelectedAudioSrc,
  selectSelectedPerspective,
  selectSelectedWord,
  selectTimingCount,
  selectTrackBounds,
} from "@/components/sw/selectors";
import type { PerspectiveRuntimeMap } from "@/components/sw/runtime";
import type { AudioPlaybackError } from "@/components/sw/types";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

const buildPerspective = (
  partial: Partial<Perspective> & {
    id: string;
    perspective: string;
    topic_id: string;
  },
): Perspective =>
  ({
    id: partial.id,
    perspective: partial.perspective,
    topic_id: partial.topic_id,
    audio_src: partial.audio_src,
    end_time: partial.end_time,
    rendered_html: partial.rendered_html,
    start_time: partial.start_time,
    wordTimings: partial.wordTimings,
    words: partial.words,
  }) as Perspective;

describe("sw selectors", () => {
  it("keeps viewer/editor selection pinned to the requested perspective when present", () => {
    const perspectives = [
      buildPerspective({ id: "a", perspective: "one", topic_id: "t" }),
      buildPerspective({ id: "b", perspective: "two", topic_id: "t" }),
    ];

    expect(
      selectSelectedPerspective({
        perspectives,
        selectedId: "b",
      })?.id,
    ).toBe("b");
    expect(
      selectSelectedPerspective({
        perspectives,
        selectedId: "missing",
      })?.id,
    ).toBe("a");
  });

  it("resolves selected audio and save audio with runtime overrides intact", () => {
    const perspective = buildPerspective({
      id: "p1",
      perspective: "hello",
      topic_id: "t",
      audio_src: "stored-key.webm",
    });
    const runtimeById: PerspectiveRuntimeMap = {
      p1: {
        audioKeyOverride: "override-key.mp4",
        audioOverride: "https://cdn.example.com/audio.mp4",
        localAudioOverride: "blob:runtime-audio",
      },
    };

    expect(
      selectPerspectiveAudioValue({
        perspective,
        runtimeById,
      }),
    ).toBe("blob:runtime-audio");
    expect(
      selectSelectedAudioSrc({
        selectedPerspective: perspective,
        runtimeById,
      }),
    ).toBe("blob:runtime-audio");
    expect(
      selectAudioValueForSave({
        perspective,
        runtimeById,
        hasAudioBase: true,
      }),
    ).toBe("override-key.mp4");
    expect(hasRuntimeAudioOverride(runtimeById.p1)).toBe(true);
  });

  it("keeps track bounds on database-backed audio and drops them when runtime audio is overridden", () => {
    const perspective = buildPerspective({
      id: "p1",
      perspective: "hello",
      topic_id: "t",
      audio_src: "stored-key.webm",
      start_time: 1.25,
      end_time: 4.5,
    });

    expect(
      selectTrackBounds({
        perspective,
        runtime: undefined,
        usesDatabaseBounds: true,
      }),
    ).toEqual({ start: 1.25, end: 4.5 });
    expect(
      selectTrackBounds({
        perspective,
        runtime: { audioOverride: "/api/obj?key=override" },
        usesDatabaseBounds: true,
      }),
    ).toEqual({ start: 0, end: undefined });
  });

  it("keeps sequence playback advancing to the next playable perspective only", () => {
    const perspectives = [
      buildPerspective({
        id: "a",
        perspective: "one",
        topic_id: "t",
        audio_src: "",
      }),
      buildPerspective({
        id: "b",
        perspective: "two",
        topic_id: "t",
        audio_src: "/api/other?key=bad",
      }),
      buildPerspective({
        id: "c",
        perspective: "three",
        topic_id: "t",
        audio_src: "next-key.webm",
      }),
    ];

    expect(
      selectNextPlayablePerspective({
        activePerspectiveId: "a",
        perspectives,
        runtimeById: {},
      })?.id,
    ).toBe("c");
  });

  it("pads timings to the rendered word list and keeps playback clock/playhead summaries stable", () => {
    const perspective = buildPerspective({
      id: "p1",
      perspective: "ignored",
      topic_id: "t",
      rendered_html:
        '<span data-word-index="0"><span class="sw-text">alpha</span></span> <span data-word-index="1"><span class="sw-text">beta</span></span> <span data-word-index="2"><span class="sw-text">gamma</span></span>',
      start_time: 2,
      wordTimings: [{ start: 0.1 }, { start: 0.5 }] satisfies WordTimingEntry[],
    });
    const runtimeById: PerspectiveRuntimeMap = {};
    const timings = selectPerspectiveTimings({ perspective, runtimeById });

    expect(timings).toEqual([{ start: 0.1 }, { start: 0.5 }, null]);
    expect(selectTimingCount(timings)).toBe(2);
    expect(
      selectPlaybackClock({
        time: 2.6,
        timings,
        usesDatabaseBounds: true,
        perspectiveStartTime: perspective.start_time,
      }),
    ).toBeCloseTo(0.6, 5);
    expect(
      selectPlayheadPercent({
        analysis: { duration: 1.2, waveform: [0.1, 0.2] },
        playbackClockTime: 0.6,
      }),
    ).toBe(50);
    expect(
      selectSelectedWord({
        selectedWords: ["alpha", "beta", "gamma"],
        selectedWordIndex: 1,
      }),
    ).toBe("beta");
  });

  it("keeps the current track and playback error summary aligned with the selected perspective", () => {
    const perspective = buildPerspective({
      id: "p1",
      perspective: "hello",
      topic_id: "t",
      audio_src: "stored-key.webm",
      start_time: 3,
      end_time: 8,
    });
    const error: AudioPlaybackError = {
      code: 4,
      message: "Codec unsupported",
      src: "/api/obj?key=stored-key.webm",
    };

    expect(resolveSwAudioSource("stored-key.webm")).toMatch(
      /stored-key\.webm$/,
    );
    expect(
      selectCurrentTrack({
        selectedPerspective: perspective,
        selectedAudioSrc: "/api/obj?key=stored-key.webm",
        hasSelectedAudio: true,
        hasSelectedAudioOverride: false,
        usesDatabaseBounds: true,
      }),
    ).toMatchObject({
      id: "p1",
      start_time: 3,
      end_time: 8,
    });
    expect(selectPlaybackErrorSummary(error)).toBe(
      "code 4 - Codec unsupported",
    );
  });
});
