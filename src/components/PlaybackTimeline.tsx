"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioWaveform } from "@/components/AudioWaveform";
import { decodeAudioBlob } from "@/lib/audioProcessing";
import {
  buildPlaybackWaveform,
  clampPlaybackTime,
  resolvePlaybackRange,
} from "@/lib/playbackTimeline";
import type { WordTimingEntry } from "@/types/perspectives";

type PlaybackTimelineProps = {
  audioSrc?: string;
  className?: string;
  currentTime: number;
  disabled?: boolean;
  duration?: number;
  endTime?: number;
  hasError?: boolean;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlayback: () => void;
  playLabel?: string;
  startTime?: number;
  timings: WordTimingEntry[];
};

export const PlaybackTimeline = ({
  audioSrc,
  className = "",
  currentTime,
  disabled = false,
  duration,
  endTime,
  hasError = false,
  isPlaying,
  onSeek,
  onTogglePlayback,
  playLabel,
  startTime,
  timings,
}: PlaybackTimelineProps) => {
  const analysisQuery = useQuery({
    queryKey: ["playback-waveform", audioSrc, startTime, endTime],
    enabled: Boolean(audioSrc),
    staleTime: Infinity,
    retry: 2,
    queryFn: async ({ signal }) => {
      // The media element can cache a response without CORS headers. Analysis
      // needs its own complete, CORS-enabled response to read the audio bytes.
      const response = await fetch(audioSrc!, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Could not load audio waveform.");
      const buffer = await decodeAudioBlob(await response.blob());
      signal.throwIfAborted();
      return {
        duration: buffer.duration,
        waveform: buildPlaybackWaveform({
          buffer,
          start: startTime,
          end: endTime,
        }),
      };
    },
  });
  const resolvedDuration = duration ?? analysisQuery.data?.duration;
  const range = useMemo(
    () =>
      resolvePlaybackRange({
        duration: resolvedDuration,
        endTime,
        startTime,
        timings,
      }),
    [resolvedDuration, endTime, startTime, timings],
  );
  const clampedTime = clampPlaybackTime(currentTime, range);
  const playheadPercent =
    ((clampedTime - range.start) / (range.end - range.start)) * 100;
  const controlLabel = playLabel ?? (isPlaying ? "Pause audio" : "Play audio");

  return (
    <div
      className={`relative z-20 flex w-full shrink-0 items-center gap-2 px-4 py-2 ${className}`}
    >
      <button
        type="button"
        onClick={onTogglePlayback}
        disabled={disabled}
        aria-label={controlLabel}
        title={controlLabel}
        className={`inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none transition ${
          disabled
            ? "cursor-not-allowed text-white/35"
            : hasError
              ? "text-red-100"
              : isPlaying
                ? "text-teal-100 text-[1rem]"
                : "text-(--color-neon-teal-light) text-[1.2rem]"
        }`}
      >
        {hasError ? "!" : isPlaying ? "■" : "▶"}
      </button>
      <div className="relative h-11 min-w-0 flex-1 rounded-lg focus-within:ring-2 focus-within:ring-[var(--color-neon-teal)] focus-within:ring-offset-2 focus-within:ring-offset-transparent">
        <AudioWaveform
          waveform={analysisQuery.data?.waveform}
          fallbackWaveform={[]}
          playheadPercent={playheadPercent}
          className="pointer-events-none h-11 rounded-lg bg-black/15"
          barsClassName="px-2 py-1.5"
        />
        <input
          type="range"
          min={range.start}
          max={range.end}
          step="0.01"
          value={clampedTime}
          disabled={disabled}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
          aria-label="Seek playback"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        {audioSrc && analysisQuery.isPending && (
          <output
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-white/70"
          >
            Loading waveform…
          </output>
        )}
        {analysisQuery.isError && (
          <button
            type="button"
            onClick={() => void analysisQuery.refetch()}
            className="absolute inset-y-0 left-1/2 -translate-x-1/2 rounded-md px-3 text-xs text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-white"
          >
            Retry waveform
          </button>
        )}
      </div>
    </div>
  );
};
