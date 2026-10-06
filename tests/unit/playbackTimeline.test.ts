import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlaybackTimeline } from "@/components/PlaybackTimeline";
import {
  buildPlaybackWaveform,
  clampPlaybackTime,
  resolvePlaybackRange,
} from "@/lib/playbackTimeline";

describe("playback timeline", () => {
  it("renders an accessible seek control over the timing bars", () => {
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(PlaybackTimeline, {
          currentTime: 2,
          duration: 5,
          isPlaying: false,
          onSeek: () => {},
          onTogglePlayback: () => {},
          timings: [{ start: 1, end: 3 }],
        }),
      ),
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

  const audioBuffer = (channels: number[][], sampleRate = 2) =>
    ({
      duration: channels[0].length / sampleRate,
      length: channels[0].length,
      numberOfChannels: channels.length,
      sampleRate,
      getChannelData: (index: number) => Float32Array.from(channels[index]),
    }) as AudioBuffer;

  it("reflects different audio amplitudes instead of word coverage", () => {
    const waveform = buildPlaybackWaveform({
      buffer: audioBuffer([[0.25, -0.25, 0.5, -0.5, 1, -1, 0, 0]]),
      barCount: 4,
    });
    expect(waveform).toEqual([0.25, 0.5, 1, 0]);
  });

  it("calculates the selected clip and retains the final samples", () => {
    expect(
      buildPlaybackWaveform({
        buffer: audioBuffer([[1, 1, 0.25, 0.25, 0.5, 0.5, 0, 0]]),
        start: 1,
        end: 3,
        barCount: 2,
      }),
    ).toEqual([0.5, 1]);
    expect(
      buildPlaybackWaveform({
        buffer: audioBuffer([[0, 0, 0, 0, 1]]),
        barCount: 2,
      }),
    ).toEqual([0, 1]);
    expect(clampPlaybackTime(0, { start: 1, end: 3 })).toBe(1);
    expect(clampPlaybackTime(4, { start: 1, end: 3 })).toBe(3);
  });

  it("preserves stereo energy even when the channels have opposite polarity", () => {
    expect(
      buildPlaybackWaveform({
        buffer: audioBuffer([
          [0.25, 0.25, 1, 1],
          [-0.25, -0.25, -1, -1],
        ]),
        barCount: 2,
      }),
    ).toEqual([0.25, 1]);
  });

  it("keeps silent audio silent and omits invalid clip ranges", () => {
    const buffer = audioBuffer([[0, 0, 0, 0]]);
    expect(buildPlaybackWaveform({ buffer, barCount: 2 })).toEqual([0, 0]);
    expect(buildPlaybackWaveform({ buffer, start: 3, end: 4 })).toEqual([]);
  });

  it("renders measured bars even when word timings cover the entire track", () => {
    const client = new QueryClient();
    client.setQueryData(
      ["playback-waveform", "/audio.wav", undefined, undefined],
      {
        duration: 4,
        waveform: [0.25, 0.5, 1, 0],
      },
    );
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(PlaybackTimeline, {
          audioSrc: "/audio.wav",
          currentTime: 2,
          isPlaying: false,
          onSeek: () => {},
          onTogglePlayback: () => {},
          timings: [{ start: 0, end: 4 }],
        }),
      ),
    );
    expect(markup).toContain("height:25%");
    expect(markup).toContain("height:50%");
    expect(markup).toContain("height:100%");
    expect(markup).toContain("height:8%");
    expect(markup).toContain('max="4"');
  });

  it("leaves the track empty while audio analysis is unavailable", () => {
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(PlaybackTimeline, {
          currentTime: 0,
          duration: 4,
          isPlaying: false,
          onSeek: () => {},
          onTogglePlayback: () => {},
          timings: [{ start: 0, end: 4 }],
        }),
      ),
    );
    expect(markup).not.toContain("<span");
    expect(markup).toContain('aria-label="Seek playback"');
  });
});
