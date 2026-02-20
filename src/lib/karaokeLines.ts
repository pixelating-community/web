import type { Perspective } from "@/types/perspectives";

export type KaraokeLineWord = {
  index: number;
  word: string;
};

const BLOCK_CLOSE_TAG_REGEX =
  /<\/(?:address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|ul)>/gi;

const decodeHtmlEntities = (value: string) =>
  value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

const htmlToPlainTextLines = (html: string) =>
  decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, "\n")
      .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(BLOCK_CLOSE_TAG_REGEX, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const rawTextToLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const linesToKaraokeWords = (lines: string[]) => {
  let wordIndex = 0;
  const karaokeLines: KaraokeLineWord[][] = [];

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    karaokeLines.push(
      words.map((word) => {
        const item = { index: wordIndex, word };
        wordIndex += 1;
        return item;
      }),
    );
  }

  return karaokeLines;
};

export const getKaraokeLines = (
  perspective: Pick<Perspective, "perspective" | "rendered_html">,
): KaraokeLineWord[][] => {
  const renderedHtml = perspective.rendered_html?.trim() ?? "";
  const sourceLines = renderedHtml
    ? htmlToPlainTextLines(renderedHtml)
    : rawTextToLines(perspective.perspective ?? "");
  return linesToKaraokeWords(sourceLines);
};
