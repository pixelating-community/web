import { compilePerspective } from "@/lib/compilePerspective";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

const decodeHtmlEntities = (value: string) =>
  value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const stripHtmlTags = (value: string) => value.replace(/<[^>]+>/g, "");

const extractWordsFromRenderedHtml = (html: string) => {
  if (!html.trim()) return [];
  const matches = Array.from(
    html.matchAll(
      /data-word-index="(\d+)"[^>]*>[\s\S]*?<span\s+class="[^"]*\bsw-text\b[^"]*">([\s\S]*?)<\/span>/gi,
    ),
  );
  if (matches.length === 0) return [];
  return matches
    .map((match) => {
      const rawIndex = Number.parseInt(match[1] ?? "", 10);
      if (!Number.isInteger(rawIndex) || rawIndex < 0) {
        return null;
      }
      const rawWord = match[2] ?? "";
      const word = decodeHtmlEntities(stripHtmlTags(rawWord)).trim();
      return { index: rawIndex, word };
    })
    .filter((entry): entry is { index: number; word: string } =>
      Boolean(entry?.word),
    )
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.word);
};

export const coerceTimingEntry = (
  timings: WordTimingEntry[],
  index: number,
) => {
  const entry = timings[index];
  if (typeof entry === "number" && Number.isFinite(entry)) {
    return { start: entry, end: null };
  }
  if (typeof entry === "string") {
    const parsed = Number.parseFloat(entry);
    if (Number.isFinite(parsed)) {
      return { start: parsed, end: null };
    }
    return null;
  }
  if (!entry || typeof entry !== "object") return null;
  const raw = entry as Record<string, unknown>;
  const toNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const start =
    toNumber(raw.start) ??
    toNumber(raw.start_time) ??
    toNumber(raw.timestamp) ??
    toNumber(raw.time);
  if (start === null) return null;
  const end =
    toNumber(raw.end) ?? toNumber(raw.end_time) ?? toNumber(raw.stop) ?? null;
  return { start, end };
};

export const getPerspectiveWords = (perspective: Perspective) => {
  if (perspective.words && perspective.words.length > 0) {
    return perspective.words;
  }
  const renderedWords = extractWordsFromRenderedHtml(
    perspective.rendered_html ?? "",
  );
  if (renderedWords.length > 0) {
    return renderedWords;
  }
  return compilePerspective(perspective.perspective ?? "").words;
};
