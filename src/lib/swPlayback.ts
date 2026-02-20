import type { WordTimingEntry } from "@/types/perspectives";

const DEFAULT_WORD_DURATION = 0.2;
const MIN_PLAYBACK_STEP = 0.01;

const coerceTiming = (timings: WordTimingEntry[], index: number) => {
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

export const normalizePlaybackTimings = (
  timings: WordTimingEntry[],
): WordTimingEntry[] => {
  let lastStart = Number.NEGATIVE_INFINITY;
  return timings.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const rawStart = entry.start;
    if (typeof rawStart !== "number" || !Number.isFinite(rawStart)) {
      return null;
    }
    const start =
      rawStart <= lastStart ? lastStart + MIN_PLAYBACK_STEP : rawStart;
    const rawEnd =
      typeof entry.end === "number" && Number.isFinite(entry.end)
        ? entry.end
        : null;
    const end = rawEnd !== null && rawEnd > start ? rawEnd : null;
    lastStart = start;
    return { ...entry, start, end: end ?? undefined };
  });
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

export const findActiveWordIndex = (
  timings: WordTimingEntry[],
  time: number,
): number => {
  if (!Number.isFinite(time)) return -1;

  for (let i = 0; i < timings.length; i += 1) {
    const timing = coerceTiming(timings, i);
    if (!timing) continue;

    const nextTiming = findNextTiming(timings, i, timing.start);
    const nextStart =
      nextTiming && nextTiming.index === i + 1 ? nextTiming.start : null;
    const candidateEnd = resolveEnd(timing, nextStart);
    const endExclusive =
      typeof candidateEnd === "number" &&
      Number.isFinite(candidateEnd) &&
      candidateEnd > timing.start
        ? candidateEnd
        : timing.start + DEFAULT_WORD_DURATION;

    if (time >= timing.start && time < endExclusive) {
      return i;
    }
  }

  return -1;
};
