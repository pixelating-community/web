"use client";

const MAX_LINE_LENGTH = 40;

type Props = { text: string | null | undefined };

export const LineLengthIndicator = ({ text }: Props) => {
  const overLimit = (text ?? "")
    .split(/\r?\n/)
    .map((line, idx) => ({ line: idx + 1, length: line.length }))
    .filter((entry) => entry.length > MAX_LINE_LENGTH);

  if (overLimit.length === 0) return null;

  const title = overLimit
    .map((e) => `L${e.line}: ${e.length}/${MAX_LINE_LENGTH}`)
    .join(", ");

  return (
    <span
      className="inline-flex items-center text-xs text-shadow-2xs text-shadow-neutral-200/20 opacity-60"
      title={title}
      aria-label={`${overLimit.length} line(s) over ${MAX_LINE_LENGTH} characters`}
    >
      {overLimit.length}/{MAX_LINE_LENGTH}
    </span>
  );
};
