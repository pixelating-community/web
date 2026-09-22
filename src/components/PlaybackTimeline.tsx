"use client";

import { useMemo } from "react";
import { AudioWaveform } from "@/components/AudioWaveform";
import {
  buildTimingWaveform,
  clampPlaybackTime,
  resolvePlaybackRange,
} from "@/lib/playbackTimeline";
import type { WordTimingEntry } from "@/types/perspectives";

type PlaybackTimelineProps = {
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
  const range = useMemo(
    () => resolvePlaybackRange({ duration, endTime, startTime, timings }),
    [duration, endTime, startTime, timings],
  );
  const waveform = useMemo(
    () =>
      buildTimingWaveform({
        end: range.end,
        start: range.start,
        timings,
      }),
    [range.end, range.start, timings],
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
          waveform={waveform}
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
      </div>
    </div>
  );
};
