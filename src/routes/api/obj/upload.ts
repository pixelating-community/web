import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import {
  CANONICAL_AUDIO_CONTENT_TYPE,
  transcodeAudioFileToM4a,
} from "@/lib/audioTranscode";
import {
  buildObjectKey,
  createObjectUploadUrl,
  getObjectPublicUrl,
  putObject,
} from "@/lib/objectStorage.server";

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

        if (contentType.includes("multipart/form-data")) {
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
        }

        const body = await request.json().catch(() => null);
        const filename =
          body && typeof body.filename === "string" ? body.filename : "";
        const jsonContentType =
          body && typeof body.contentType === "string" ? body.contentType : "";

        if (!filename) {
          return Response.json({ error: "filename required" }, { status: 400 });
        }

        const resolvedContentType = jsonContentType?.startsWith("audio/") ||
          jsonContentType?.startsWith("image/")
          ? jsonContentType
          : guessContentType(filename);

        const key = buildObjectKey(filename);
        const uploadUrl = await createObjectUploadUrl({
          key,
          contentType: resolvedContentType,
        });

        return Response.json({
          key,
          uploadUrl,
          publicUrl: getObjectPublicUrl(key),
        });
      },
    },
  },
});
