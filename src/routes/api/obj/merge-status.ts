import { z } from "zod/v4";
import { createFileRoute } from "@tanstack/react-router";
import { onMergeComplete } from "@/lib/mergeEvents";

export const Route = createFileRoute("/api/obj/merge-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const perspectiveId = url.searchParams.get("perspectiveId");
        const parsed = z.uuid().safeParse(perspectiveId);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid perspectiveId" },
            { status: 400 },
          );
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const send = (data: Record<string, unknown>) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            };

            const timeout = setTimeout(() => {
              send({ status: "timeout" });
              controller.close();
            }, 120_000);

            const unsubscribe = onMergeComplete(parsed.data, (event) => {
              clearTimeout(timeout);
              send(event);
              controller.close();
            });

            request.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              unsubscribe();
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
    },
  },
});
