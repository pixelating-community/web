import type { ActionScope } from "@/lib/actionToken";

export const UPLOAD_ACTION_TOKEN_HEADER = "x-pxl8-action-token";
export const UPLOAD_TOPIC_ID_HEADER = "x-pxl8-topic-id";
export const UPLOAD_SCOPE_HEADER = "x-pxl8-upload-scope";
export const UPLOAD_PERSPECTIVE_ID_HEADER = "x-pxl8-perspective-id";

export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_MULTIPART_UPLOAD_BYTES = MAX_AUDIO_UPLOAD_BYTES + 1024 * 1024;

const uploadScopes = new Set<ActionScope>([
  "perspective:add",
  "perspective:edit",
  "perspective:align",
]);

export type UploadRequestMetadata = {
  actionToken: string;
  topicId: string;
  scope: "perspective:add" | "perspective:edit" | "perspective:align";
  perspectiveId?: string;
};
export const readUploadRequestMetadata = (
  headers: Headers,
): UploadRequestMetadata | null => {
  const actionToken = headers.get(UPLOAD_ACTION_TOKEN_HEADER)?.trim() ?? "";
  const topicId = headers.get(UPLOAD_TOPIC_ID_HEADER)?.trim() ?? "";
  const rawScope = headers.get(UPLOAD_SCOPE_HEADER)?.trim() ?? "";
  const perspectiveId =
    headers.get(UPLOAD_PERSPECTIVE_ID_HEADER)?.trim() || undefined;

  if (!actionToken || !topicId || !uploadScopes.has(rawScope as ActionScope)) {
    return null;
  }

  return {
    actionToken,
    topicId,
    scope: rawScope as UploadRequestMetadata["scope"],
    perspectiveId,
  };
};

export const getUploadSizeLimit = (contentType: string) => {
  if (contentType.startsWith("audio/")) return MAX_AUDIO_UPLOAD_BYTES;
  if (contentType.startsWith("image/")) return MAX_IMAGE_UPLOAD_BYTES;
  return 0;
};
