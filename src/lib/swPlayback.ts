import type { WordTimingEntry } from "@/types/perspectives";

const DEFAULT_WORD_DURATION = 0.2;
const NORMALIZED_START_STEP = 0.01;
const TIME_PRECISION = 1_000_000;

const roundTime = (value: number) =>
  Math.round(value * TIME_PRECISION) / TIME_PRECISION;

const toTimingNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const coerceTimingValue = (entry: unknown) => {
  if (typeof entry === "number" && Number.isFinite(entry)) {
    return { start: entry, end: null };
  }
  if (typeof entry === "string") {
    const start = toTimingNumber(entry);
    return start === null ? null : { start, end: null };
  }
  if (!entry || typeof entry !== "object") return null;

  const raw = entry as Record<string, unknown>;
  const start =
    toTimingNumber(raw.start) ??
    toTimingNumber(raw.start_time) ??
    toTimingNumber(raw.timestamp) ??
    toTimingNumber(raw.time);
  if (start === null) return null;
  const end =
    toTimingNumber(raw.end) ??
    toTimingNumber(raw.end_time) ??
    toTimingNumber(raw.stop) ??
    null;
  return { start, end };
};

export const normalizePlaybackTimings = (
  timings: WordTimingEntry[],
): WordTimingEntry[] => {
  let previousStart = Number.NEGATIVE_INFINITY;
  return timings.map((entry) => {
    const timing = coerceTimingValue(entry);
    if (!timing) return null;

    const start = roundTime(
      Math.max(0, timing.start, previousStart + NORMALIZED_START_STEP),
    );
    previousStart = start;
    const end =
      typeof timing.end === "number" &&
      Number.isFinite(timing.end) &&
      timing.end > start
        ? timing.end
        : undefined;

    if (!entry || typeof entry !== "object") {
      return end === undefined ? { start } : { start, end };
    }
    if (end === undefined) {
      const { end: _end, ...rest } = entry;
      return { ...rest, start };
    }
    return { ...entry, start, end };
  });
};

export const coerceTiming = (timings: WordTimingEntry[], index: number) => {
  return coerceTimingValue(timings[index]);
};

const findNextTiming = (
  timings: WordTimingEntry[],
  index: number,
  currentStart = -1,
) => {
  for (let i = index + 1; i < timings.length; i += 1) {
    const timing = coerceTiming(timings, i);
    if (timing && timing.start > currentStart) {
      return { index: i, start: timing.start };
    }
  }
  return null;
};

const resolveEnd = (
  timing: { start: number; end: number | null },
  nextStart: number | null,
) => {
  if (
    typeof timing.end === "number" &&
    Number.isFinite(timing.end) &&
    timing.end > timing.start
  ) {
    return timing.end;
  }
  if (
    typeof nextStart === "number" &&
    Number.isFinite(nextStart) &&
    nextStart > timing.start
  ) {
    return nextStart;
  }
  return null;
};

export const getTimingDuration = (
  timings: WordTimingEntry[],
  index: number,
): number => {
  const timing = coerceTiming(timings, index);
  if (!timing) return 0;
  const nextTiming = findNextTiming(timings, index, timing.start);
  const nextStart =
    nextTiming && nextTiming.index === index + 1 ? nextTiming.start : null;
  const candidateEnd = resolveEnd(timing, nextStart);
  if (
    typeof candidateEnd !== "number" ||
    !Number.isFinite(candidateEnd) ||
    candidateEnd <= timing.start
  ) {
    return DEFAULT_WORD_DURATION;
  }
  return Math.max(candidateEnd - timing.start, DEFAULT_WORD_DURATION);
};

/**
 * Find the active word. Assumes timings are sorted by start (ascending),
 * which normalizePlaybackTimings guarantees, but still tolerates null gaps.
 */
export const findActiveWordIndex = (
  timings: WordTimingEntry[],
  time: number,
): number => {
  if (!Number.isFinite(time)) return -1;

  let candidate = -1;
  for (let index = 0; index < timings.length; index += 1) {
    const timing = coerceTiming(timings, index);
    if (!timing) continue;
    if (timing.start <= time) {
      candidate = index;
      continue;
    }
    break;
  }

  if (candidate < 0) return -1;

  const timing = coerceTiming(timings, candidate);
  if (!timing) return -1;

  const nextTiming = findNextTiming(timings, candidate, timing.start);
  const nextStart =
    nextTiming && nextTiming.index === candidate + 1 ? nextTiming.start : null;
  const candidateEnd = resolveEnd(timing, nextStart);
  const endExclusive =
    typeof candidateEnd === "number" &&
    Number.isFinite(candidateEnd) &&
    candidateEnd > timing.start
      ? candidateEnd
      : timing.start + DEFAULT_WORD_DURATION;

  return time < endExclusive ? candidate : -1;
};
