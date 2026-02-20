import path from "node:path";
import { createFileRoute } from "@tanstack/react-router";
import {
  buildObjectKey,
  createObjectUploadUrl,
  getObjectPublicUrl,
  putObject,
} from "@/lib/objectStorage";

const guessContentType = (filename: string) => {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".webm": "audio/webm",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
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
          const filename = file.name || "recording";
          const resolvedContentType = file.type?.startsWith("audio/")
            ? file.type
            : guessContentType(filename);
          const key = buildObjectKey(filename);
          const buffer = Buffer.from(await file.arrayBuffer());
          await putObject({
            key,
            contentType: resolvedContentType,
            body: buffer,
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

        const resolvedContentType = jsonContentType?.startsWith("audio/")
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
