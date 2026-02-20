import type { WordTimingEntry } from "@/types/perspectives";

const normalizeWord = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
};

const toMappedTiming = (
  entry: WordTimingEntry,
  word: string,
): WordTimingEntry => {
  if (!entry || typeof entry !== "object") return null;
  const start = entry.start;
  if (typeof start !== "number" || !Number.isFinite(start) || start < 0) {
    return null;
  }
  const end =
    typeof entry.end === "number" &&
    Number.isFinite(entry.end) &&
    entry.end > start
      ? entry.end
      : undefined;
  return { start, end, word };
};

export const preserveWordTimings = ({
  oldTimings,
  oldWords,
  newWords,
}: {
  oldTimings: WordTimingEntry[];
  oldWords: string[];
  newWords: string[];
}): WordTimingEntry[] => {
  if (newWords.length === 0) return [];

  const nextTimings = Array.from(
    { length: newWords.length },
    () => null as WordTimingEntry,
  );
  if (oldWords.length === 0 || oldTimings.length === 0) return nextTimings;

  const oldNormalized = oldWords.map(normalizeWord);
  const newNormalized = newWords.map(normalizeWord);
  const usedOldIndices = new Set<number>();

  const assign = (oldIndex: number, newIndex: number) => {
    const mapped = toMappedTiming(oldTimings[oldIndex], newWords[newIndex]);
    if (!mapped) return false;
    nextTimings[newIndex] = mapped;
    usedOldIndices.add(oldIndex);
    return true;
  };

  let prefixIndex = 0;
  while (
    prefixIndex < oldWords.length &&
    prefixIndex < newWords.length &&
    oldNormalized[prefixIndex] &&
    oldNormalized[prefixIndex] === newNormalized[prefixIndex]
  ) {
    assign(prefixIndex, prefixIndex);
    prefixIndex += 1;
  }

  let oldTail = oldWords.length - 1;
  let newTail = newWords.length - 1;
  while (
    oldTail >= prefixIndex &&
    newTail >= prefixIndex &&
    oldNormalized[oldTail] &&
    oldNormalized[oldTail] === newNormalized[newTail]
  ) {
    assign(oldTail, newTail);
    oldTail -= 1;
    newTail -= 1;
  }

  let oldCursor = prefixIndex;
  for (let newIndex = prefixIndex; newIndex <= newTail; newIndex += 1) {
    if (nextTimings[newIndex] !== null) continue;
    const target = newNormalized[newIndex];
    if (!target) continue;
    for (let oldIndex = oldCursor; oldIndex <= oldTail; oldIndex += 1) {
      if (usedOldIndices.has(oldIndex)) continue;
      if (oldNormalized[oldIndex] !== target) continue;
      assign(oldIndex, newIndex);
      oldCursor = oldIndex + 1;
      break;
    }
  }

  const oldMaxIndex = oldWords.length - 1;
  if (oldMaxIndex >= 0) {
    const newMaxIndex = Math.max(newWords.length - 1, 1);
    for (let newIndex = 0; newIndex < newWords.length; newIndex += 1) {
      if (nextTimings[newIndex] !== null) continue;
      const ratio = newIndex / newMaxIndex;
      const guessIndex = Math.round(oldMaxIndex * ratio);
      if (usedOldIndices.has(guessIndex)) continue;
      assign(guessIndex, newIndex);
    }
  }

  return nextTimings;
};
