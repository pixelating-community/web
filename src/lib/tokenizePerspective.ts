export type WordToken = {
  value: string;
  isSpace: boolean;
  wordIndex: number | null;
};

const getFenceInfo = (value: string) => {
  const match = value.match(/^(`{3,}|~{3,})/);
  if (!match) return null;
  const fence = match[1];
  return { char: fence[0], length: fence.length };
};

const updateInlineFence = (current: number | null, value: string) => {
  if (!value.includes("`")) return current;
  const runs = value.match(/`+/g);
  if (!runs) return current;
  let fence = current;
  for (const run of runs) {
    const length = run.length;
    if (fence === null) {
      fence = length;
    } else if (length === fence) {
      fence = null;
    }
  }
  return fence;
};

export const tokenizePerspective = (text: string): WordToken[] => {
  const parts = text.split(/(\s+)/);
  let wordIndex = -1;
  let lineStart = true;
  let inFencedCode = false;
  let fenceChar: string | null = null;
  let fenceLength = 0;
  let inlineFence: number | null = null;
  let inHtmlComment = false;
  const tokens: WordToken[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part) continue;
    const isSpace = /^\s+$/.test(part);
    if (isSpace) {
      tokens.push({ value: part, isSpace: true, wordIndex: null });
      if (part.includes("\n")) {
        lineStart = true;
      }
      continue;
    }

    const nextPart = parts[i + 1] ?? "";
    const wasInFencedCode = inFencedCode;
    const wasInHtmlComment = inHtmlComment;
    const opensHtmlComment = part.includes("<!--");
    const closesHtmlComment = part.includes("-->");
    const htmlCommentToken = wasInHtmlComment || opensHtmlComment;

    if (!wasInHtmlComment && opensHtmlComment) {
      inHtmlComment = !closesHtmlComment;
    } else if (wasInHtmlComment && closesHtmlComment) {
      inHtmlComment = false;
    }

    let isFenceToken = false;

    if (!htmlCommentToken && lineStart) {
      const fence = getFenceInfo(part);
      if (fence) {
        isFenceToken = true;
        if (!inFencedCode) {
          inFencedCode = true;
          fenceChar = fence.char;
          fenceLength = fence.length;
          inlineFence = null;
        } else if (fenceChar === fence.char && fence.length >= fenceLength) {
          inFencedCode = false;
          fenceChar = null;
          fenceLength = 0;
        }
      }
    }

    let isInlineToken = false;
    if (!htmlCommentToken && !wasInFencedCode && !inFencedCode) {
      const wasInline = inlineFence !== null;
      const hasBackticks = part.includes("`");
      inlineFence = updateInlineFence(inlineFence, part);
      const isInlineNow = inlineFence !== null;
      isInlineToken = hasBackticks || wasInline || isInlineNow;
    }

    const isHeadingMarker =
      lineStart &&
      !wasInFencedCode &&
      !inFencedCode &&
      !htmlCommentToken &&
      inlineFence === null &&
      /^#{1,6}$/.test(part) &&
      /^\s+$/.test(nextPart) &&
      /[ \t]/.test(nextPart);

    const isNonWord =
      htmlCommentToken ||
      isFenceToken ||
      wasInFencedCode ||
      inFencedCode ||
      isInlineToken ||
      isHeadingMarker;

    let tokenWordIndex: number | null = null;
    if (!isNonWord) {
      wordIndex += 1;
      tokenWordIndex = wordIndex;
    }
    tokens.push({ value: part, isSpace: false, wordIndex: tokenWordIndex });
    lineStart = false;
  }

  return tokens;
};

export const extractWords = (tokens: WordToken[]): string[] =>
  tokens
    .filter((token) => token.wordIndex !== null)
    .map((token) => token.value);
