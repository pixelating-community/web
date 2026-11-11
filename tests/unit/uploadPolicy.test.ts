import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  UPLOAD_ACTION_TOKEN_HEADER,
  UPLOAD_PERSPECTIVE_ID_HEADER,
  UPLOAD_SCOPE_HEADER,
  UPLOAD_TOPIC_ID_HEADER,
  getUploadSizeLimit,
  readUploadRequestMetadata,
} from "@/lib/uploadPolicy";

describe("object upload policy", () => {
  it("requires action token, topic, and an upload-safe action scope", () => {
    const headers = new Headers({
      [UPLOAD_ACTION_TOKEN_HEADER]: "signed-token",
      [UPLOAD_PERSPECTIVE_ID_HEADER]: "perspective-id",
      [UPLOAD_SCOPE_HEADER]: "perspective:align",
      [UPLOAD_TOPIC_ID_HEADER]: "topic-id",
    });

    expect(readUploadRequestMetadata(headers)).toEqual({
      actionToken: "signed-token",
      perspectiveId: "perspective-id",
      scope: "perspective:align",
      topicId: "topic-id",
    });

    headers.set(UPLOAD_SCOPE_HEADER, "perspective:delete");
    expect(readUploadRequestMetadata(headers)).toBeNull();
    headers.delete(UPLOAD_ACTION_TOKEN_HEADER);
    expect(readUploadRequestMetadata(headers)).toBeNull();
  });

  it("bounds audio, image and supported video uploads", () => {
    expect(getUploadSizeLimit("audio/webm")).toBe(MAX_AUDIO_UPLOAD_BYTES);
    expect(getUploadSizeLimit("image/png")).toBe(MAX_IMAGE_UPLOAD_BYTES);
    expect(getUploadSizeLimit("video/mp4")).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(getUploadSizeLimit("video/webm")).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(getUploadSizeLimit("video/quicktime")).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(getUploadSizeLimit("video/x-msvideo")).toBe(0);
    expect(getUploadSizeLimit("application/octet-stream")).toBe(0);
  });
});
