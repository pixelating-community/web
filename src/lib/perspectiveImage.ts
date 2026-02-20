import type { Perspective } from "@/types/perspectives";

const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export const extractMarkdownBackgroundImageSrc = (markdown: string | null | undefined) => {
  const source = markdown ?? "";
  MARKDOWN_IMAGE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = MARKDOWN_IMAGE_REGEX.exec(source);
  while (match) {
    const alt = (match[1] ?? "").trim().toLowerCase();
    const src = (match[2] ?? "").trim();
    if (src && (alt === "bg" || alt === "background")) {
      return src;
    }
    match = MARKDOWN_IMAGE_REGEX.exec(source);
  }
  return "";
};

export const resolvePerspectiveBackgroundImageSrc = (
  perspective: Pick<Perspective, "image_src" | "perspective">,
) =>
  perspective.image_src?.trim() ||
  extractMarkdownBackgroundImageSrc(perspective.perspective);
