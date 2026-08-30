import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import {
  CANONICAL_AUDIO_CONTENT_TYPE,
  transcodeAudioFileToM4a,
} from "@/lib/audioTranscode";
import {
  buildObjectKey,
  getObjectPublicUrl,
  putObject,
} from "@/lib/objectStorage.server";
import { verifyActionToken } from "@/lib/actionToken.server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  MAX_MULTIPART_UPLOAD_BYTES,
  getUploadSizeLimit,
  readUploadRequestMetadata,
} from "@/lib/uploadPolicy";

const guessContentType = (filename: string) => {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".webm": "audio/webm",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return map[ext] ?? "application/octet-stream";
};

export const Route = createFileRoute("/api/obj/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
          return Response.json(
            { error: "multipart form data required" },
            { status: 415 },
          );
        }

        const metadata = readUploadRequestMetadata(request.headers);
        if (!metadata) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const verified = verifyActionToken({
          token: metadata.actionToken,
          requiredScope: metadata.scope,
          topicId: metadata.topicId,
          perspectiveId: metadata.perspectiveId,
        });
        if (!verified) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ip = getClientIp(request.headers);
        const rate = rateLimit(
          `object-upload:${metadata.topicId}:${ip}`,
          20,
          10 * 60 * 1000,
        );
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429, headers: rateLimitHeaders(rate) },
          );
        }

        const rawContentLength = request.headers.get("content-length");
        const contentLength = rawContentLength
          ? Number.parseInt(rawContentLength, 10)
          : 0;
        if (
          Number.isFinite(contentLength) &&
          contentLength > MAX_MULTIPART_UPLOAD_BYTES
        ) {
          return Response.json({ error: "File is too large" }, { status: 413 });
        }

        try {
          const formData = await request.formData().catch(() => null);
          if (!formData) {
            return Response.json(
              { error: "invalid form data" },
              { status: 400 },
            );
          }
          const file = formData.get("file");
          if (!file || !(file instanceof File)) {
            return Response.json({ error: "file required" }, { status: 400 });
          }
          let filename = file.name || "recording";
          const formContentTypeHint = formData.get("contentTypeHint");
          const contentTypeHint =
            typeof formContentTypeHint === "string"
              ? formContentTypeHint.trim()
              : "";
          const rawPitchSemitones = formData.get("pitchSemitones");
          const parsedPitch =
            typeof rawPitchSemitones === "string"
              ? Number.parseFloat(rawPitchSemitones)
              : 0;
          const pitchSemitones =
            Number.isFinite(parsedPitch)
              ? Math.max(-12, Math.min(12, parsedPitch))
              : 0;
          const resolvedContentType = contentTypeHint.startsWith("audio/") ||
            contentTypeHint.startsWith("image/")
            ? contentTypeHint
            : file.type?.startsWith("audio/")
              ? file.type
              : file.type?.startsWith("image/")
                ? file.type
                : guessContentType(filename);
          const sizeLimit = getUploadSizeLimit(resolvedContentType);
          if (!sizeLimit) {
            return Response.json(
              { error: "Only audio and image files are supported" },
              { status: 415 },
            );
          }
          if (file.size <= 0) {
            return Response.json({ error: "File is empty" }, { status: 400 });
          }
          if (file.size > sizeLimit) {
            return Response.json({ error: "File is too large" }, { status: 413 });
          }
          let uploadBody: Buffer;
          let uploadContentType = resolvedContentType;
          if (resolvedContentType.startsWith("audio/")) {
            const transcoded = await transcodeAudioFileToM4a({
              file,
              filename,
              contentType: resolvedContentType,
              pitchSemitones,
            });
            filename = transcoded.filename;
            uploadBody = transcoded.body;
            uploadContentType =
              transcoded.contentType || CANONICAL_AUDIO_CONTENT_TYPE;
          } else {
            uploadBody = Buffer.from(await file.arrayBuffer());
          }
          const key = buildObjectKey(filename);
          await putObject({
            key,
            contentType: uploadContentType,
            body: uploadBody,
          });
          return Response.json({
            key,
            publicUrl: getObjectPublicUrl(key),
          });
        } catch (error) {
          console.error("Object upload failed", {
            topicId: metadata.topicId,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json({ error: "Upload failed" }, { status: 500 });
        }
      },
    },
  },
});
