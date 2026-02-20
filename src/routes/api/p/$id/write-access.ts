import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  getReflectionWriteCookieName,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { getRequestCookie } from "@/server/lib/requestCookies";

export const Route = createFileRoute("/api/p/$id/write-access")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`write-access:${ip}`, 60, 60 * 1000);
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429, headers: rateLimitHeaders(rate) },
          );
        }
        const schema = z.object({ id: z.uuid() });
        let data: { id: string };
        try {
          data = schema.parse({ id: params.id });
        } catch {
          return Response.json({ error: "Invalid id" }, { status: 400 });
        }

        const token = getRequestCookie(
          request,
          getReflectionWriteCookieName(data.id),
        );
        const chargeId = verifyReflectionWriteToken(token, data.id);
        if (!chargeId) {
          return Response.json(
            { write: false },
            { status: 401, headers: { "Cache-Control": "no-store" } },
          );
        }

        return Response.json(
          { write: true },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
