import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlaybackTimeline } from "@/components/PlaybackTimeline";
import {
  buildTimingWaveform,
  clampPlaybackTime,
  resolvePlaybackRange,
} from "@/lib/playbackTimeline";

describe("playback timeline", () => {
  it("renders an accessible seek control over the timing bars", () => {
    const markup = renderToStaticMarkup(
      createElement(PlaybackTimeline, {
        currentTime: 2,
        duration: 5,
        isPlaying: false,
        onSeek: () => {},
        onTogglePlayback: () => {},
        timings: [{ start: 1, end: 3 }],
      }),
    );

    expect(markup).toContain('type="range"');
    expect(markup).toContain('aria-label="Seek playback"');
    expect(markup).toContain('min="0"');
    expect(markup).toContain('max="5"');
  });

  it("uses explicit clip bounds ahead of media and timing duration", () => {
    expect(
      resolvePlaybackRange({
        duration: 20,
        endTime: 8,
        startTime: 3,
        timings: [{ start: 1, end: 12 }],
      }),
    ).toEqual({ start: 3, end: 8 });
  });

  it("falls back from media duration to the final word timing", () => {
    expect(
      resolvePlaybackRange({
        timings: [{ start: 1, end: 2 }, null, { start: 4, end: 5 }],
      }),
    ).toEqual({ start: 0, end: 5 });
  });

  it("builds time-based speech coverage bars and preserves silent gaps", () => {
    const bars = buildTimingWaveform({
      barCount: 4,
      start: 0,
      end: 4,
      timings: [
        { start: 0, end: 1 },
        null,
        { start: 2, end: 3 },
      ],
    });

    expect(bars).toEqual([1, 0, 1, 0]);
  });

  it("clips timing coverage and seek values to the active range", () => {
    expect(
      buildTimingWaveform({
        barCount: 2,
        start: 1,
        end: 3,
        timings: [{ start: 0, end: 1.5 }, { start: 2.5, end: 4 }],
      }),
    ).toEqual([0.5, 0.5]);
    expect(clampPlaybackTime(0, { start: 1, end: 3 })).toBe(1);
    expect(clampPlaybackTime(4, { start: 1, end: 3 })).toBe(3);
  });
});
