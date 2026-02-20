const normalizePathSegment = (value: string) =>
  encodeURIComponent(value.trim());

export const NEW_PERSPECTIVE_QUERY_VALUE = "n";
export const NEW_PERSPECTIVE_HASH = "n";

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
  `${buildTopicPath(topicName)}/r/${normalizePathSegment(perspectiveId.trim())}`;

export const buildTopicWritePerspectivePath = ({
  topicName,
  perspectiveId,
}: {
  topicName: string;
  perspectiveId: string;
}) =>
  `${buildTopicPath(topicName)}/w/${normalizePathSegment(perspectiveId.trim())}`;

export const buildTopicNewPerspectivePath = (topicName: string) =>
  `${buildTopicPath(topicName)}/w/${encodeURIComponent(NEW_PERSPECTIVE_QUERY_VALUE)}`;


export const buildTopicViewerPerspectivePath = ({
  topicName,
  perspectiveId,
}: {
  topicName: string;
  perspectiveId: string;
}) =>
  `${buildTopicPath(topicName)}/p/${normalizePathSegment(perspectiveId.trim())}`;

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

  return raw;
};
