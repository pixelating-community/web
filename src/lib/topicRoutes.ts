const normalizePathSegment = (value: string) =>
  encodeURIComponent(value.trim());

export const buildTopicPath = (topicName: string, action = "") => {
  const normalizedTopicName = topicName.trim();
  const normalizedAction = action.trim();

  if (!normalizedTopicName) {
    return "/t";
  }

  if (!normalizedAction) {
    return `/t/${normalizePathSegment(normalizedTopicName)}`;
  }

  return `/t/${normalizePathSegment(normalizedTopicName)}/${normalizePathSegment(normalizedAction)}`;
};

export const buildTopicPerspectivePath = ({
  topicName,
  perspectiveId,
}: {
  topicName: string;
  perspectiveId: string;
}) =>
  `${buildTopicPath(topicName, "w")}?p=${encodeURIComponent(perspectiveId.trim())}`;

// Backward-compatible alias while removing /sw route usage.
export const buildTopicSwPerspectivePath = buildTopicPerspectivePath;

export const buildTopicUnlockHref = ({
  topicName,
  nextPath,
}: {
  topicName: string;
  nextPath: string;
}) =>
  `/t/${normalizePathSegment(topicName)}/ul?next=${encodeURIComponent(nextPath)}`;

export const sanitizeTopicNextPath = ({
  nextPath,
  fallbackPath,
}: {
  nextPath?: string | null;
  fallbackPath: string;
}) => {
  const raw = typeof nextPath === "string" ? nextPath.trim() : "";
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  if (!raw.startsWith("/t/")) return fallbackPath;
  if (raw.includes("/ul")) return fallbackPath;

  const [pathname, query = ""] = raw.split("?");
  const segments = pathname.split("/");
  if (segments.length >= 4 && segments[1] === "t" && segments[3] === "sw") {
    segments[3] = "w";
    const rewrittenPath = segments.join("/");
    return query ? `${rewrittenPath}?${query}` : rewrittenPath;
  }

  return raw;
};
