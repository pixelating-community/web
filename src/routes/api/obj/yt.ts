import { z } from "zod/v4";
import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { audioImportSchema, deleteAudio, importAudioFile } from "@/lib/audioImport.server";

const IMPORT_KEEPALIVE_INTERVAL_MS = 15_000;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
            let closed = false;
            let closeTimer: ReturnType<typeof setTimeout> | undefined;
            const enqueue = (chunk: string) => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(chunk));
              } catch {
                closed = true;
              }
            };
            const send = (payload: Record<string, unknown>) => {
              enqueue(`data: ${JSON.stringify(payload)}\n\n`);
            };
            const close = () => {
              if (closed) return;
              closed = true;
              clearInterval(keepaliveId);
              if (closeTimer) clearTimeout(closeTimer);
              controller.close();
            };
            const finish = () => {
              if (closed) return;
              clearInterval(keepaliveId);
              closeTimer = setTimeout(close, 250);
            };
            const keepaliveId = setInterval(() => {
              enqueue(`: import keepalive ${Date.now()}\n\n`);
            }, IMPORT_KEEPALIVE_INTERVAL_MS);
            request.signal.addEventListener(
              "abort",
              () => {
                closed = true;
                clearInterval(keepaliveId);
                if (closeTimer) clearTimeout(closeTimer);
              },
              { once: true },
            );

            send({ step: "preparing" });

            importAudioFile({
              data,
              file,
              onProgress: (step) => send({ step }),
            }).then((result) => {
              if (result.ok) {
                send({ step: "done", r2Key: result.r2Key });
              } else {
                console.error("[audio-import] failed", {
                  perspectiveId: data.perspectiveId,
                  status: result.status,
                  error: result.error,
                });
                send({ step: "error", error: result.error });
              }
              finish();
            }).catch((error) => {
              const message = getErrorMessage(error);
              console.error("[audio-import] crashed", {
                perspectiveId: data.perspectiveId,
                error: message,
                stack: error instanceof Error ? error.stack : undefined,
              });
              send({
                step: "error",
                error: `Import failed: ${message.slice(0, 200)}`,
              });
              finish();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
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
