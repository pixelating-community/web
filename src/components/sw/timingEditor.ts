import { coerceTimingEntry } from "@/components/sw/editorUtils";
import { DEFAULT_WORD_DURATION } from "@/components/sw/runtime";
import type { WordTimingEntry } from "@/types/perspectives";

export const getTimingEditorIndex = ({
  selectedWordIndex,
  wordsLength,
}: {
  selectedWordIndex?: number;
  wordsLength: number;
}) => {
  if (wordsLength <= 0) return -1;
  if (selectedWordIndex !== undefined && selectedWordIndex >= 0) {
    return Math.min(selectedWordIndex, wordsLength - 1);
  }
  return 0;
};

export const buildTimingEntries = ({
  existingTimings,
  wordsLength,
}: {
  existingTimings: WordTimingEntry[];
  wordsLength: number;
}) =>
  Array.from({ length: wordsLength }, (_, index) => {
    const entry = existingTimings[index];
    return entry === undefined ? null : entry;
  });

export const buildTimingStartEntry = ({
  existing,
  start,
}: {
  existing: WordTimingEntry;
  start: number;
}) => {
  const safeStart = Math.max(0, start);
  const rawEnd =
    existing && typeof existing === "object" ? existing.end : undefined;
  const end =
    typeof rawEnd === "number" && Number.isFinite(rawEnd) ? rawEnd : undefined;
  return {
    start: safeStart,
    end,
  };
};

export const buildTimingEndEntry = ({
  end,
  existing,
}: {
  end: number;
  existing: WordTimingEntry;
}) => {
  const start =
    existing && typeof existing === "object"
      ? existing.start
      : Math.max(0, end - DEFAULT_WORD_DURATION);
  return {
    start,
    end,
  };
};

export const buildMarkAndForwardState = ({
  currentTime,
  existingTimings,
  selectedWordIndex,
  wordsLength,
}: {
  currentTime: number;
  existingTimings: WordTimingEntry[];
  selectedWordIndex?: number;
  wordsLength: number;
}) => {
  const currentIndex = getTimingEditorIndex({
    selectedWordIndex,
    wordsLength,
  });
  if (currentIndex < 0) return null;
  const nextTimings = buildTimingEntries({
    existingTimings,
    wordsLength,
  });
  // Don't overwrite the last word if it already has a timing
  const isLastWord = currentIndex === wordsLength - 1;
  const alreadyMarked = nextTimings[currentIndex] != null;
  if (isLastWord && alreadyMarked) return null;
  nextTimings[currentIndex] = buildTimingStartEntry({
    existing: nextTimings[currentIndex],
    start: currentTime,
  });
  return {
    nextSelectedWordIndex: Math.min(wordsLength - 1, currentIndex + 1),
    nextTimings,
  };
};

export const buildUndoLastMarkState = ({
  existingTimings,
  selectedWordIndex,
  wordsLength,
}: {
  existingTimings: WordTimingEntry[];
  selectedWordIndex?: number;
  wordsLength: number;
}) => {
  const currentIndex = getTimingEditorIndex({
    selectedWordIndex,
    wordsLength,
  });
  if (currentIndex < 0) return null;
  const targetIndex = Math.max(0, currentIndex - 1);
  const nextTimings = buildTimingEntries({
    existingTimings,
    wordsLength,
  });
  const previousTiming = coerceTimingEntry(nextTimings, targetIndex);
  nextTimings[targetIndex] = null;
  return {
    nextSelectedWordIndex: targetIndex,
    nextTimings,
    seekTime: previousTiming?.start ?? 0,
  };
};

export const buildClearAllMarkTimings = (wordsLength: number) =>
  Array.from({ length: wordsLength }, () => null);
