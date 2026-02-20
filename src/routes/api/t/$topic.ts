import { createFileRoute } from "@tanstack/react-router";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import { getTopicPayload } from "@/lib/getTopicPayload.server";

const topicAuthHeaders = (requestId: string, headers?: HeadersInit) => {
  const next = requestIdHeaders(requestId, headers);
  next.set("Cache-Control", "private, no-store, max-age=0");
  next.set("Pragma", "no-cache");
  next.set("Vary", "Cookie");
  return next;
};

export const Route = createFileRoute("/api/t/$topic")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const requestId = getRequestId(request);
        const topicName = (params.topic ?? "").split("?")[0].trim();
        const action =
          new URL(request.url).searchParams.get("action")?.trim() ?? "";
        const result = await getTopicPayload({
          action,
          request,
          topicName,
        });

        if (result.data) {
          return Response.json(result.data, {
            headers: topicAuthHeaders(requestId),
          });
        }

        const status =
          result.error === "topic required"
            ? 400
            : result.error === "topic not found"
              ? 404
              : 500;

        return Response.json(
          { error: result.error },
          { status, headers: topicAuthHeaders(requestId) },
        );
      },
    },
  },
});
