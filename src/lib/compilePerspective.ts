type CompiledPerspective = {
  renderedHtml: string;
  words: string[];
  visibleWordIndices: number[];
};

type CompilePerspectiveOptions = {
  wrapWords?: boolean;
};

type BunMarkdownApi = {
  html: (markdownText: string) => string;
};

const isSafeHref = (href: string) => {
  const trimmed = href.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("/")) return true;
  if (trimmed.startsWith("mailto:")) return true;
  if (trimmed.startsWith("javascript:")) return false;
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getBunMarkdownApi = (): BunMarkdownApi | undefined => {
  const globalWithBun = globalThis as unknown as {
    Bun?: { markdown?: BunMarkdownApi };
  };
  return globalWithBun.Bun?.markdown;
};

const sanitizeRenderedLinks = (html: string) =>
  html.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    const hrefMatch = attrs.match(/\shref=("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const href = hrefMatch
      ? (hrefMatch[2] ?? hrefMatch[3] ?? hrefMatch[4] ?? "")
      : "";

    if (!href || !isSafeHref(href)) {
      const withoutHref = attrs.replace(
        /\shref=("[^"]*"|'[^']*'|[^\s>]+)/i,
        "",
      );
      return `<a${withoutHref}>`;
    }

    let nextAttrs = attrs;
    if (!/\srel=/i.test(nextAttrs)) {
      nextAttrs += ' rel="noopener noreferrer"';
    }
    if (!/\starget=/i.test(nextAttrs)) {
      nextAttrs += ' target="_blank"';
    }

    return `<a${nextAttrs}>`;
  });

const renderMarkdownHtml = (markdownText: string) => {
  const api = getBunMarkdownApi();
  if (!api?.html) {
    // Fallback for non-Bun environments.
    return escapeHtml(markdownText).replaceAll("\n", "<br />\n");
  }

  return sanitizeRenderedLinks(api.html(markdownText));
};

const transformRenderedHtml = (html: string, wrapWords: boolean) => {
  let cursor = 0;
  let result = "";
  let lastIndex = 0;
  let codeDepth = 0;
  const words: string[] = [];
  const tagRegex = /<\/?[^>]+>/g;

  const wrapText = (text: string, inCode: boolean) => {
    if (!text || !text.trim() || inCode) return text;
    const parts = text.split(/(\s+)/);
    return parts
      .map((part) => {
        if (!part) return "";
        if (/^\s+$/.test(part)) return part;
        const wordIndex = cursor;
        cursor += 1;
        words.push(part);
        if (!wrapWords) {
          return part;
        }
        return `<span class="sw-word" data-word-index="${wordIndex}"><span class="sw-bg"></span><span class="sw-text">${part}</span></span>`;
      })
      .join("");
  };

  let match: RegExpExecArray | null = tagRegex.exec(html);
  while (match) {
    const tag = match[0];
    const text = html.slice(lastIndex, match.index);
    result += wrapText(text, codeDepth > 0);

    const tagNameMatch = tag.match(/^<\/?\s*([a-z0-9-]+)/i);
    const tagName = tagNameMatch?.[1]?.toLowerCase() ?? "";
    if (tag.startsWith("</")) {
      if (tagName === "code" || tagName === "pre") {
        codeDepth = Math.max(0, codeDepth - 1);
      }
    } else if (tagName === "code" || tagName === "pre") {
      codeDepth += 1;
    }

    result += tag;
    lastIndex = match.index + tag.length;
    match = tagRegex.exec(html);
  }

  const tail = html.slice(lastIndex);
  result += wrapText(tail, codeDepth > 0);
  return { renderedHtml: result, words };
};

export const compilePerspective = (
  markdownText: string,
  options: CompilePerspectiveOptions = {},
): CompiledPerspective => {
  const source = markdownText ?? "";
  const rendered = renderMarkdownHtml(source);
  const wrapped = transformRenderedHtml(rendered, options.wrapWords ?? false);
  const visibleWordIndices = Array.from(
    { length: wrapped.words.length },
    (_, index) => index,
  );
  return {
    renderedHtml: wrapped.renderedHtml,
    words: wrapped.words,
    visibleWordIndices,
  };
};
