import { compilePerspective } from "@/lib/compilePerspective";

const escapeWord = (word: string) => {
  const markdown = (globalThis as { Bun?: { markdown?: unknown } }).Bun
    ?.markdown;
  return markdown ? word.replace(/[\\`*_[\]<>#+~|]/g, "\\$&") : word;
};
const decodeWord = (word: string) =>
  word
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");

export const replacePerspectiveWord = ({
  text,
  index,
  expectedWord,
  word,
}: {
  text: string;
  index: number;
  expectedWord: string;
  word: string;
}) => {
  const previous = compilePerspective(text);
  if (previous.words[index] !== expectedWord) {
    throw new Error("This word changed elsewhere. Reload before editing it.");
  }
  const value = word.trim();
  if (!value || /\s/.test(value) || value.length > 200) {
    throw new Error("Enter one word without spaces.");
  }
  const replacement = escapeWord(value);
  const replacementWords = compilePerspective(replacement).words;
  if (replacementWords.length !== 1) throw new Error("Enter one word.");
  const nextWord = replacementWords[0];
  if (nextWord === expectedWord) return { text, ...previous, word: nextWord };
  const candidates = new Set([
    expectedWord,
    decodeWord(expectedWord),
    escapeWord(decodeWord(expectedWord)),
  ]);
  for (const candidate of candidates) {
    let position = text.indexOf(candidate);
    while (position >= 0) {
      const updated =
        text.slice(0, position) +
        replacement +
        text.slice(position + candidate.length);
      const compiled = compilePerspective(updated);
      if (
        compiled.words.length === previous.words.length &&
        compiled.words.every(
          (entry, i) => entry === (i === index ? nextWord : previous.words[i]),
        )
      ) {
        return { text: updated, ...compiled, word: nextWord };
      }
      position = text.indexOf(candidate, position + 1);
    }
  }
  throw new Error("This word’s formatting needs the full text editor.");
};
