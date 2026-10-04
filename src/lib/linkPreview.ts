import { resolvePerspectiveBackgroundImageSrc } from "@/lib/perspectiveImage";

export const SITE_TITLE = "pxl8";
export const SITE_DESCRIPTION = "Stories shaped by voices, votes, and support.";

type PreviewPerspective = {
  perspective: string | null;
  image_src?: string | null;
};

export type LinkPreview = {
  title: string;
  description: string;
  image?: string;
  path?: string;
};

const decodeEntities = (text: string) =>
  text.replace(
    /&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,
    (entity, code: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
        nbsp: " ",
      };
      if (!code.startsWith("#")) return named[code.toLowerCase()] ?? entity;
      const value =
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return value > 0 &&
        value <= 0x10ffff &&
        !(value >= 0xd800 && value <= 0xdfff)
        ? String.fromCodePoint(value)
        : "";
    },
  );

export const getPreviewText = (markdown: string) =>
  decodeEntities(
    markdown
      .replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<https?:\/\/[^>]+>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, "")
      .replace(/[*_~`]/g, "")
      .replace(/\s+/g, " "),
  ).trim();

const truncate = (text: string, limit: number) => {
  const characters = Array.from(text);
  if (characters.length <= limit) return text;
  const prefix = characters.slice(0, limit - 1).join("");
  const lastSpace = prefix.lastIndexOf(" ");
  const endsInsideWord = !/\s/.test(characters[limit - 1] ?? "");
  return `${(endsInsideWord && lastSpace > prefix.length / 2
    ? prefix.slice(0, lastSpace)
    : prefix
  ).trimEnd()}…`;
};

export const buildContentLinkPreview = ({
  topicName,
  shortTitle,
  emoji,
  perspectives = [],
  selectedPerspective,
  locked = false,
  path,
}: {
  topicName: string;
  shortTitle?: string;
  emoji?: string;
  perspectives?: PreviewPerspective[];
  selectedPerspective?: PreviewPerspective | null;
  locked?: boolean;
  path: string;
}): LinkPreview => {
  const topicTitle = [emoji?.trim(), shortTitle?.trim() || topicName]
    .filter(Boolean)
    .join(" ");
  if (locked) {
    return {
      title: topicTitle,
      description: "Unlock this private topic to view its stories.",
      path,
    };
  }

  const content = selectedPerspective ? [selectedPerspective] : perspectives;
  const excerpt = content
    .map((p) => getPreviewText(p.perspective ?? ""))
    .filter(Boolean)
    .join(" · ");
  const firstLine = selectedPerspective?.perspective
    ?.split(/\r?\n/)
    .map(getPreviewText)
    .find(Boolean);
  const image = content
    .map(
      (p) =>
        resolvePerspectiveBackgroundImageSrc({
          perspective: p.perspective ?? "",
          image_src: p.image_src ?? undefined,
        }) ||
        p.perspective?.match(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/)?.[1],
    )
    .find(Boolean);

  return {
    title: firstLine
      ? `${truncate(firstLine, 80)} · ${topicTitle}`
      : topicTitle,
    description: excerpt
      ? truncate(excerpt, 320)
      : `Explore stories and perspectives in ${topicTitle}.`,
    image,
    path,
  };
};

export const getLinkPreviewOrigin = (
  matches: readonly { loaderData?: unknown }[],
) => {
  const data = matches[0]?.loaderData;
  if (
    data &&
    typeof data === "object" &&
    "linkPreviewOrigin" in data &&
    typeof data.linkPreviewOrigin === "string"
  ) {
    return data.linkPreviewOrigin;
  }
  return undefined;
};

const absoluteHttpUrl = (
  value: string | undefined,
  base: string | undefined,
) => {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
};

export const buildLinkPreviewHead = (preview: LinkPreview, origin?: string) => {
  const url = absoluteHttpUrl(preview.path, origin);
  const image =
    absoluteHttpUrl(preview.image, url ?? origin) ??
    absoluteHttpUrl("/512x512.png", origin);
  return {
    meta: [
      {
        title:
          preview.title === SITE_TITLE
            ? SITE_TITLE
            : `${preview.title} | ${SITE_TITLE}`,
      },
      { name: "description", content: preview.description },
      { property: "og:site_name", content: SITE_TITLE },
      { property: "og:type", content: "website" },
      { property: "og:title", content: preview.title },
      { property: "og:description", content: preview.description },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: preview.title },
      { name: "twitter:description", content: preview.description },
      ...(url ? [{ property: "og:url", content: url }] : []),
      ...(image
        ? [
            { property: "og:image", content: image },
            { property: "og:image:alt", content: preview.title },
            { name: "twitter:image", content: image },
            { name: "twitter:image:alt", content: preview.title },
          ]
        : []),
    ],
  };
};
