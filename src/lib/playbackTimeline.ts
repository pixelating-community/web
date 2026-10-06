import { coerceTiming, getTimingDuration } from "@/lib/swPlayback";
import type { WordTimingEntry } from "@/types/perspectives";

const DEFAULT_BAR_COUNT = 120;
const MINIMUM_RANGE_SECONDS = 0.01;

const finiteNonnegative = (value: number | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

export const getLastTimingEnd = (timings: WordTimingEntry[]) => {
  let lastEnd = 0;
  for (let index = 0; index < timings.length; index += 1) {
    const timing = coerceTiming(timings, index);
    if (!timing) continue;
    lastEnd = Math.max(
      lastEnd,
      timing.start + getTimingDuration(timings, index),
    );
  }
  return lastEnd;
};

export const resolvePlaybackRange = ({
  duration,
  endTime,
  startTime,
  timings,
}: {
  duration?: number;
  endTime?: number;
  startTime?: number;
  timings: WordTimingEntry[];
}) => {
  const start = finiteNonnegative(startTime) ?? 0;
  const requestedEnd = finiteNonnegative(endTime);
  const mediaEnd = finiteNonnegative(duration);
  const timingEnd = getLastTimingEnd(timings);
  const endCandidate = requestedEnd ?? mediaEnd ?? timingEnd;
  const end = Math.max(
    start + MINIMUM_RANGE_SECONDS,
    endCandidate || start + 1,
  );
  return { end, start };
};

export const clampPlaybackTime = (
  value: number,
  range: { end: number; start: number },
) => Math.min(range.end, Math.max(range.start, value));

export const buildPlaybackWaveform = ({
  barCount = DEFAULT_BAR_COUNT,
  buffer,
  end,
  start = 0,
}: {
  barCount?: number;
  buffer: AudioBuffer;
  end?: number;
  start?: number;
}) => {
  const count = Number.isFinite(barCount)
    ? Math.max(1, Math.floor(barCount))
    : DEFAULT_BAR_COUNT;
  if (!buffer.length || !buffer.numberOfChannels || !(buffer.sampleRate > 0))
    return [];
  const firstSample = Math.min(
    buffer.length,
    Math.floor((finiteNonnegative(start) ?? 0) * buffer.sampleRate),
  );
  const lastSample = Math.min(
    buffer.length,
    Math.ceil((finiteNonnegative(end) ?? buffer.duration) * buffer.sampleRate),
  );
  if (lastSample <= firstSample) return [];
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const waveform = Array.from<number>({ length: count }).fill(0);
  for (let bin = 0; bin < count; bin += 1) {
    const from =
      firstSample + Math.floor(((lastSample - firstSample) * bin) / count);
    const to =
      firstSample +
      Math.floor(((lastSample - firstSample) * (bin + 1)) / count);
    let sumSquares = 0;
    for (const channel of channels) {
      for (let sample = from; sample < to; sample += 1) {
        const value = channel[sample] ?? 0;
        sumSquares += value * value;
      }
    }
    const sampleCount = (to - from) * channels.length;
    waveform[bin] = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  }
  const peak = Math.max(...waveform);
  return peak > 0 ? waveform.map((value) => value / peak) : waveform;
};
