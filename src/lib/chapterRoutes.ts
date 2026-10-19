export const CONTENT_LABEL = "chapter";
export const CONTENT_QUERY_KEY = "chapter-payload";

const normalizePathSegment = (value: string) =>
  encodeURIComponent(value.trim());

export const NEW_PERSPECTIVE_QUERY_VALUE = "n";
export const NEW_PERSPECTIVE_HASH = "n";

export const buildPerspectiveJoinPath = (perspectiveId: string) =>
  `/p/${normalizePathSegment(perspectiveId.trim())}/join`;

export const buildTopicPath = (topicName: string, action = "") => {
  const normalizedTopicName = topicName.trim();
  const normalizedAction = action.trim();

  if (!normalizedTopicName) {
    return "/c";
  }

  if (!normalizedAction) {
    return `/c/${normalizePathSegment(normalizedTopicName)}`;
  }

  return `/c/${normalizePathSegment(normalizedTopicName)}/${normalizePathSegment(normalizedAction)}`;
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

export const buildNewReflectionPerspectivePath = ({
  topicName,
  parentPerspectiveId,
}: {
  topicName: string;
  parentPerspectiveId: string;
}) =>
  `${buildTopicNewPerspectivePath(topicName)}?parent=${encodeURIComponent(parentPerspectiveId)}`;

export const buildTopicViewerPerspectivePath = ({
  topicName,
  perspectiveId,
}: {
  topicName: string;
  perspectiveId: string;
}) =>
  `${buildTopicPath(topicName)}/p/${normalizePathSegment(perspectiveId.trim())}`;

export const buildTopicKaraokePath = ({
  topicName,
  perspectiveId,
}: {
  topicName: string;
  perspectiveId: string;
}) =>
  `${buildTopicPath(topicName)}/k/${normalizePathSegment(perspectiveId.trim())}`;

export const buildTopicKaraokeEditorPath = ({
  topicName,
  perspectiveId,
}: {
  topicName: string;
  perspectiveId: string;
}) =>
  `${buildTopicPath(topicName)}/ke/${normalizePathSegment(perspectiveId.trim())}`;

export const buildTopicUnlockHref = ({
  topicName,
  nextPath,
}: {
  topicName: string;
  nextPath: string;
}) =>
  `/c/${normalizePathSegment(topicName)}/ul?next=${encodeURIComponent(nextPath)}`;

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
  if (!raw.startsWith("/c/")) return fallbackPath;
  if (raw.includes("/ul")) return fallbackPath;

  return raw;
};
