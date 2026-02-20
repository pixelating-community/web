import type { WordTimingEntry } from "@/types/perspectives";

const DEFAULT_WORD_DURATION = 0.2;

export const coerceTiming = (timings: WordTimingEntry[], index: number) => {
  const entry = timings[index];
  if (!entry || typeof entry !== "object") return null;
  const start = entry.start;
  if (typeof start !== "number" || !Number.isFinite(start)) return null;
  const end =
    typeof entry.end === "number" && Number.isFinite(entry.end)
      ? entry.end
      : null;
  return { start, end };
};

const findNextTiming = (
  timings: WordTimingEntry[],
  index: number,
  currentStart = -1,
) => {
  for (let i = index + 1; i < timings.length; i += 1) {
    const start = timings[i]?.start;
    if (
      typeof start === "number" &&
      Number.isFinite(start) &&
      start > currentStart
    ) {
      return { index: i, start };
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
 * Binary search for the active word. Assumes timings are sorted by start
 * (ascending) — which normalizePlaybackTimings guarantees.
 */
export const findActiveWordIndex = (
  timings: WordTimingEntry[],
  time: number,
): number => {
  if (!Number.isFinite(time)) return -1;

  // Binary search: find the last timed entry whose start <= time
  let lo = 0;
  let hi = timings.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const timing = coerceTiming(timings, mid);
    if (!timing) {
      // null entry — scan right to find a valid one
      let found = false;
      for (let j = mid + 1; j <= hi; j++) {
        if (coerceTiming(timings, j)) {
          lo = j;
          found = true;
          break;
        }
      }
      if (!found) {
        hi = mid - 1;
      }
      continue;
    }
    if (timing.start <= time) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
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
