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

const TAG_ATTR_REGEX =
  /([^\s=/>]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;

const isSafeEmbedSrc = (src: string) => {
  try {
    const url = new URL(src);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return false;
    if (hostname !== "bandcamp.com" && hostname !== "www.bandcamp.com") {
      return false;
    }
    return url.pathname.startsWith("/EmbeddedPlayer/");
  } catch {
    return false;
  }
};

const getTagAttributeValue = (attrs: string, name: string) => {
  const pattern = new RegExp(
    `\\s${name}=("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = attrs.match(pattern);
  return match ? (match[2] ?? match[3] ?? match[4] ?? "") : "";
};

const getTagAttributes = (attrs: string) => {
  const entries = new Map<string, string | true>();
  TAG_ATTR_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = TAG_ATTR_REGEX.exec(attrs);
  while (match) {
    const name = match[1]?.toLowerCase();
    if (name) {
      entries.set(name, match[3] ?? match[4] ?? match[5] ?? true);
    }
    match = TAG_ATTR_REGEX.exec(attrs);
  }
  return entries;
};

const getBunMarkdownApi = (): BunMarkdownApi | undefined => {
  const globalWithBun = globalThis as unknown as {
    Bun?: { markdown?: BunMarkdownApi };
  };
  return globalWithBun.Bun?.markdown;
};

const sanitizeRenderedLinks = (html: string) =>
  html.replace(/<a\b([^>]*)>/gi, (_full, attrs: string) => {
    const href = getTagAttributeValue(attrs, "href");

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

const stripDangerousElements = (html: string) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*\/?>/gi, "");

const sanitizeRenderedIframes = (html: string) =>
  html.replace(
    /<iframe\b([^>]*)>([\s\S]*?)<\/iframe>/gi,
    (_full, attrs: string, innerHtml: string) => {
      const attributeMap = getTagAttributes(attrs);
      const src = attributeMap.get("src");
      if (typeof src !== "string" || !isSafeEmbedSrc(src)) {
        return innerHtml;
      }

      const nextAttrs = [`src="${escapeHtml(src)}"`];
      const style = attributeMap.get("style");
      if (typeof style === "string" && style.trim()) {
        nextAttrs.push(`style="${escapeHtml(style.trim())}"`);
      }
      const title = attributeMap.get("title");
      if (typeof title === "string" && title.trim()) {
        nextAttrs.push(`title="${escapeHtml(title.trim())}"`);
      }
      if (attributeMap.has("seamless")) {
        nextAttrs.push("seamless");
      }
      nextAttrs.push('loading="lazy"');
      return `<iframe ${nextAttrs.join(" ")}>${innerHtml}</iframe>`;
    },
  );

const stripUnsafeAttributes = (html: string) =>
  html.replace(/<([a-z0-9-]+)\b([^>]*)>/gi, (full, tagName: string, attrs: string) => {
    const lowerTagName = tagName.toLowerCase();
    if (lowerTagName === "iframe") return full;
    const strippedAttrs = attrs
      .replace(/\s+on[a-z0-9-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    const trimmedAttrs = strippedAttrs.replace(/\s+$/, "");
    return `<${tagName}${trimmedAttrs}>`;
  });

const renderMarkdownHtml = (markdownText: string) => {
  const api = getBunMarkdownApi();
  if (!api?.html) {
    // Fallback for non-Bun environments.
    return escapeHtml(markdownText).replaceAll("\n", "<br />\n");
  }

  return sanitizeRenderedLinks(
    stripUnsafeAttributes(
      sanitizeRenderedIframes(stripDangerousElements(api.html(markdownText))),
    ),
  );
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
