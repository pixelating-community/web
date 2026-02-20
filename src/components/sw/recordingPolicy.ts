import type { WordTimingEntry } from "@/types/perspectives";

export const buildTimingsForRecordedAudio = (
  words: string[],
): WordTimingEntry[] => Array.from({ length: words.length }, () => null);
