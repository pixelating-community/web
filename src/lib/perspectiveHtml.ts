import type { Perspective } from "@/types/perspectives";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toFallbackHtml = (text: string) => {
  const escaped = escapeHtml(text);
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll("\n", "<br />"))
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
};

export const getPerspectiveHtml = (
  perspective: Pick<Perspective, "perspective" | "rendered_html">,
) => {
  const rendered = perspective.rendered_html?.trim();
  if (rendered) {
    return rendered;
  }
  return toFallbackHtml(perspective.perspective ?? "");
};
