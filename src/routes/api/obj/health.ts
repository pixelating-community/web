import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db.server";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";

const healthHeaders = (requestId: string) => {
  const headers = requestIdHeaders(requestId);
  headers.set("Cache-Control", "no-store");
  return headers;
};

export const Route = createFileRoute("/api/obj/health")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestId = getRequestId(request);
        try {
          await sql`SELECT 1 AS healthy;`;
          return Response.json(
            { ok: true },
            { headers: healthHeaders(requestId) },
          );
        } catch (error) {
          console.error("Health check failed", {
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          return Response.json(
            { ok: false },
            { status: 503, headers: healthHeaders(requestId) },
          );
        }
      },
    },
  },
});
