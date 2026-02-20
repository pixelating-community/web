import { z } from "zod/v4";
import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { audioImportSchema, deleteAudio, importAudioFile } from "@/lib/audioImport.server";

export const Route = createFileRoute("/api/obj/yt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`yt-audio:${ip}`, 5, 60 * 1000);
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429 },
          );
        }

        const contentType = request.headers.get("content-type") ?? "";
        let data: z.infer<typeof audioImportSchema>;
        let file: File | undefined;

        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData().catch(() => null);
          if (!formData) {
            return Response.json({ error: "Invalid form data" }, { status: 400 });
          }
          const parsed = audioImportSchema.safeParse({
            actionToken: formData.get("actionToken"),
            topicId: formData.get("topicId"),
            perspectiveId: formData.get("perspectiveId"),
            r2Key: formData.get("r2Key") || undefined,
          });
          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", issues: parsed.error.issues },
              { status: 400 },
            );
          }
          data = parsed.data;
          const fileField = formData.get("file");
          if (fileField instanceof File && fileField.size > 0) {
            file = fileField;
          }
        } else {
          const body = await request.json().catch(() => null);
          const parsed = audioImportSchema.safeParse(body);
          if (!parsed.success) {
            return Response.json(
              { error: "Invalid input", issues: parsed.error.issues },
              { status: 400 },
            );
          }
          data = parsed.data;
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const send = (payload: Record<string, unknown>) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
              );
            };

            importAudioFile({
              data,
              file,
              onProgress: (step) => send({ step }),
            }).then((result) => {
              if (result.ok) {
                send({ step: "done", r2Key: result.r2Key });
              } else {
                send({ step: "error", error: result.error });
              }
              controller.close();
            }).catch(() => {
              send({ step: "error", error: "Import failed" });
              controller.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
      DELETE: async ({ request }) => {
        const body = await request.json().catch(() => null);
        const parsed = z
          .object({
            actionToken: z.string().min(1),
            topicId: z.uuid(),
            perspectiveId: z.uuid(),
          })
          .safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const result = await deleteAudio(parsed.data);
        if (!result.ok) {
          return Response.json(
            { error: result.error },
            { status: result.status },
          );
        }
        return Response.json({ ok: true });
      },
    },
  },
});
