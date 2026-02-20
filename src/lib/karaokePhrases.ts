import type { WordTimingEntry } from "@/types/perspectives";
import type { Cue } from "@/types/symbol";

// Allowlist of Tailwind/utility classes that may be applied to word elements.
// Anything not in this list is silently dropped.
export const KARAOKE_WORD_CLASS_OPTIONS = [
  // sizing
  "text-xs", "text-sm", "text-base", "text-lg", "text-xl",
  "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl",
  "text-7xl", "text-8xl", "text-9xl", "text-fluid",
  // weight
  "font-thin", "font-light", "font-normal", "font-medium",
  "font-semibold", "font-bold", "font-extrabold", "font-black",
  // style
  "italic", "not-italic", "uppercase", "lowercase", "capitalize",
  // color
  "text-white", "text-black", "text-red-200", "text-red-300",
  "text-orange-200", "text-orange-300", "text-amber-200", "text-amber-300",
  "text-yellow-200", "text-yellow-300", "text-lime-200", "text-lime-300",
  "text-green-200", "text-green-300", "text-emerald-200", "text-emerald-300",
  "text-teal-200", "text-teal-300", "text-cyan-200", "text-cyan-300",
  "text-sky-200", "text-sky-300", "text-blue-200", "text-blue-300",
  "text-violet-200", "text-violet-300", "text-purple-200", "text-purple-300",
  "text-fuchsia-200", "text-fuchsia-300", "text-pink-200", "text-pink-300",
  "text-rose-200", "text-rose-300",
  // animation
  "animate-pulse", "animate-bounce",
  // opacity
  "opacity-50", "opacity-75", "opacity-100",
] as const;

const ALLOWED_WORD_CLASSES = new Set<string>(KARAOKE_WORD_CLASS_OPTIONS);

const truthyClassImportantPrefix = /^!+/;

const TEXT_SIZE_STYLES: Record<string, string> = {
  "text-xs": "0.75rem",
  "text-sm": "0.875rem",
  "text-base": "1rem",
  "text-lg": "1.125rem",
  "text-xl": "1.25rem",
  "text-2xl": "1.5rem",
  "text-3xl": "1.875rem",
  "text-4xl": "2.25rem",
  "text-5xl": "3rem",
  "text-6xl": "3.75rem",
  "text-7xl": "4.5rem",
  "text-8xl": "6rem",
  "text-9xl": "8rem",
  "text-fluid": "clamp(0.25rem, 3.5vw, 12rem)",
};

const FONT_WEIGHT_STYLES: Record<string, number> = {
  "font-thin": 100,
  "font-light": 300,
  "font-normal": 400,
  "font-medium": 500,
  "font-semibold": 600,
  "font-bold": 700,
  "font-extrabold": 800,
  "font-black": 900,
};

const TEXT_COLOR_PATTERN =
  /^text-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|violet|purple|fuchsia|pink|rose)-(200|300)$/;

const normalizeClassToken = (token: string) =>
  token.trim().replace(truthyClassImportantPrefix, "");

const getCurrentClassToken = (raw: string) =>
  raw.match(/(?:^|\s)(!*\S*)$/)?.[1] ?? "";

const splitClassInputAtCurrentToken = (raw: string) => {
  const match = raw.match(/^(.*\s)?(!*\S*)$/);
  return {
    prefix: match?.[1] ?? "",
    token: match?.[2] ?? "",
  };
};

/**
 * Parse a space-separated class string and return only classes in the allowlist.
 * Safe to apply via classList.add — no raw HTML involved.
 */
export const sanitizeWordClasses = (raw: string): string[] =>
  raw
    .split(/\s+/)
    .map(normalizeClassToken)
    .filter((token) => token.length > 0 && ALLOWED_WORD_CLASSES.has(token));

export const getKaraokeStyleSuggestions = (
  raw: string,
  limit = 10,
): string[] => {
  const currentToken = getCurrentClassToken(raw);
  const normalizedToken = normalizeClassToken(currentToken);
  const existingClasses = new Set(sanitizeWordClasses(raw));

  return KARAOKE_WORD_CLASS_OPTIONS.filter((option) => {
    if (normalizedToken.length > 0) {
      return option.startsWith(normalizedToken) && option !== normalizedToken;
    }
    return !existingClasses.has(option);
  }).slice(0, limit);
};

export const applyKaraokeStyleSuggestion = (
  raw: string,
  suggestion: string,
): string => {
  const normalizedSuggestion = normalizeClassToken(suggestion);
  if (!ALLOWED_WORD_CLASSES.has(normalizedSuggestion)) return raw;

  const { prefix, token } = splitClassInputAtCurrentToken(raw);
  const importantPrefix = token.match(truthyClassImportantPrefix)?.[0] ?? "";
  return `${prefix}${importantPrefix}${normalizedSuggestion} `;
};

export type Phrase = {
  startIndex: number;
  endIndex: number;
  colorIndex: number;
  midiNote?: number;
  classes?: string[];
};

export type KaraokeWordInlineStyle = Record<string, number | string>;

export const getKaraokeWordInlineStyle = (
  classes: string[] | undefined,
): KaraokeWordInlineStyle | undefined => {
  if (!classes || classes.length === 0) return undefined;
  const style: KaraokeWordInlineStyle = {};

  for (const className of classes) {
    if (className in TEXT_SIZE_STYLES) {
      style.fontSize = TEXT_SIZE_STYLES[className];
      style.lineHeight = "1";
      continue;
    }
    if (className in FONT_WEIGHT_STYLES) {
      style.fontWeight = FONT_WEIGHT_STYLES[className];
      continue;
    }
    if (className === "italic" || className === "not-italic") {
      style.fontStyle = className === "italic" ? "italic" : "normal";
      continue;
    }
    if (
      className === "uppercase" ||
      className === "lowercase" ||
      className === "capitalize"
    ) {
      style.textTransform = className;
      continue;
    }
    if (className === "text-white" || className === "text-black") {
      style.color = `var(--color-${className.slice("text-".length)})`;
      continue;
    }
    const colorMatch = className.match(TEXT_COLOR_PATTERN);
    if (colorMatch) {
      style.color = `var(--color-${colorMatch[1]}-${colorMatch[2]})`;
      continue;
    }
    if (className === "opacity-50") {
      style.opacity = 0.5;
      continue;
    }
    if (className === "opacity-75") {
      style.opacity = 0.75;
      continue;
    }
    if (className === "opacity-100") {
      style.opacity = 1;
    }
  }

  return Object.keys(style).length > 0 ? style : undefined;
};

const KARAOKE_PHRASE_SYMBOL_CONTENT = "karaoke-phrase";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const coerceFiniteInteger = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
};

export const normalizeKaraokePhrases = (value: unknown): Phrase[] => {
  if (!Array.isArray(value)) return [];
  const phrases: Phrase[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const rawStartIndex = coerceFiniteInteger(item.startIndex);
    const rawEndIndex = coerceFiniteInteger(item.endIndex);
    if (rawStartIndex === null || rawEndIndex === null) continue;
    if (rawStartIndex < 0 || rawEndIndex < 0) continue;
    const colorIndex = coerceFiniteInteger(item.colorIndex) ?? phrases.length;
    const midiNote = coerceFiniteInteger(item.midiNote);
    const rawClasses = Array.isArray(item.classes)
      ? item.classes.filter((entry): entry is string => typeof entry === "string").join(" ")
      : typeof item.classes === "string"
        ? item.classes
        : "";
    const classes = sanitizeWordClasses(rawClasses);
    phrases.push({
      startIndex: Math.min(rawStartIndex, rawEndIndex),
      endIndex: Math.max(rawStartIndex, rawEndIndex),
      colorIndex: Math.max(0, colorIndex),
      ...(midiNote !== null ? { midiNote } : {}),
      ...(classes.length > 0 ? { classes } : {}),
    });
  }
  return phrases;
};

const isKaraokePhraseSymbol = (symbol: unknown) =>
  isRecord(symbol) &&
  symbol.type === "css" &&
  symbol.content === KARAOKE_PHRASE_SYMBOL_CONTENT;

export const normalizeSymbolList = (symbols: unknown): Cue[] => {
  const value =
    typeof symbols === "string" && symbols.trim().length > 0
      ? (() => {
          try {
            return JSON.parse(symbols) as unknown;
          } catch {
            return [];
          }
        })()
      : symbols;
  return Array.isArray(value)
    ? value.filter((symbol): symbol is Cue => isRecord(symbol))
    : [];
};

export const getKaraokePhrasesFromSymbols = (symbols: unknown): Phrase[] => {
  return normalizeKaraokePhrases(
    normalizeSymbolList(symbols).filter(isKaraokePhraseSymbol).map((symbol) => ({
      classes: typeof symbol.style === "string" ? symbol.style : "",
      colorIndex: symbol.track,
      endIndex: symbol.cell,
      startIndex: symbol.wordIndex,
    })),
  );
};

export const setKaraokePhrasesInSymbols = (
  symbols: unknown,
  phrases: Phrase[],
): Cue[] => {
  const existingSymbols = normalizeSymbolList(symbols).filter(
    (symbol) => !isKaraokePhraseSymbol(symbol),
  );
  const phraseSymbols = normalizeKaraokePhrases(phrases).map((phrase) => ({
    cell: phrase.endIndex,
    content: KARAOKE_PHRASE_SYMBOL_CONTENT,
    style: phrase.classes?.join(" ") ?? "",
    timestamp: 0,
    track: phrase.colorIndex,
    type: "css" as const,
    wordIndex: phrase.startIndex,
  }));
  return [...existingSymbols, ...phraseSymbols];
};

export const PHRASE_GRADIENTS = [
  { start: "oklch(0.70 0.25 305 / 0.5)", end: "oklch(0.65 0.25 345 / 0.5)" },
  { start: "oklch(0.74 0.20 195 / 0.5)", end: "oklch(0.70 0.18 160 / 0.5)" },
  { start: "oklch(0.68 0.22 35 / 0.5)", end: "oklch(0.65 0.25 15 / 0.5)" },
  { start: "oklch(0.72 0.20 130 / 0.5)", end: "oklch(0.68 0.22 90 / 0.5)" },
  { start: "oklch(0.65 0.28 270 / 0.5)", end: "oklch(0.60 0.25 240 / 0.5)" },
  { start: "oklch(0.70 0.25 0 / 0.5)", end: "oklch(0.65 0.28 340 / 0.5)" },
] as const;

export const getPhraseBounds = (
  timings: WordTimingEntry[],
  phrase: Phrase,
): { start: number; end: number } | null => {
  let start: number | null = null;
  let end: number | null = null;

  for (let i = phrase.startIndex; i <= phrase.endIndex; i++) {
    const t = timings[i];
    if (!t) continue;
    if (start === null || t.start < start) start = t.start;
    const wordEnd = t.end ?? t.start;
    if (end === null || wordEnd > end) end = wordEnd;
  }

  if (start === null || end === null) return null;
  return { start, end };
};

export const findPhraseForWord = (
  phrases: Phrase[],
  wordIndex: number,
): Phrase | null => {
  for (const phrase of phrases) {
    if (wordIndex >= phrase.startIndex && wordIndex <= phrase.endIndex) {
      return phrase;
    }
  }
  return null;
};

export const nextColorIndex = (phrases: Phrase[]): number => {
  const used = new Set(phrases.map((p) => p.colorIndex));
  for (let i = 0; i < PHRASE_GRADIENTS.length; i++) {
    if (!used.has(i)) return i;
  }
  return phrases.length % PHRASE_GRADIENTS.length;
};
