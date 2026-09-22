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
  const end = Math.max(start + MINIMUM_RANGE_SECONDS, endCandidate || start + 1);
  return { end, start };
};

export const clampPlaybackTime = (
  value: number,
  range: { end: number; start: number },
) => Math.min(range.end, Math.max(range.start, value));

export const buildTimingWaveform = ({
  barCount = DEFAULT_BAR_COUNT,
  end,
  start,
  timings,
}: {
  barCount?: number;
  end: number;
  start: number;
  timings: WordTimingEntry[];
}) => {
  const count = Math.max(1, Math.floor(barCount));
  const span = Math.max(MINIMUM_RANGE_SECONDS, end - start);
  const binDuration = span / count;
  const coverage = Array.from<number>({ length: count }).fill(0);

  for (let index = 0; index < timings.length; index += 1) {
    const timing = coerceTiming(timings, index);
    if (!timing) continue;
    const segmentStart = Math.max(start, timing.start);
    const segmentEnd = Math.min(
      end,
      timing.start + getTimingDuration(timings, index),
    );
    if (segmentEnd <= segmentStart) continue;

    const firstBin = Math.max(
      0,
      Math.min(count - 1, Math.floor((segmentStart - start) / binDuration)),
    );
    const lastBin = Math.max(
      firstBin,
      Math.min(
        count - 1,
        Math.floor((segmentEnd - start - Number.EPSILON) / binDuration),
      ),
    );

    for (let bin = firstBin; bin <= lastBin; bin += 1) {
      const binStart = start + bin * binDuration;
      const binEnd = binStart + binDuration;
      const overlap = Math.max(
        0,
        Math.min(segmentEnd, binEnd) - Math.max(segmentStart, binStart),
      );
      coverage[bin] = Math.min(1, (coverage[bin] ?? 0) + overlap / binDuration);
    }
  }

  return coverage;
};
