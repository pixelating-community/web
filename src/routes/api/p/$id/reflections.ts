import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  loadPerspectiveReflectionsServer,
  reflectionListSchema,
} from "@/lib/reflectionRoute.server";

export const Route = createFileRoute("/api/p/$id/reflections")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`reflections:${ip}:${params.id}`, 60, 60 * 1000);
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429, headers: rateLimitHeaders(rate) },
          );
        }
        let data: z.infer<typeof reflectionListSchema>;
        try {
          data = reflectionListSchema.parse({
            perspectiveId: params.id,
            elKey: request.headers.get("x-el-key") ?? undefined,
          });
        } catch {
          return Response.json({ error: "Invalid id" }, { status: 400 });
        }

        const result = await loadPerspectiveReflectionsServer({
          request,
          data,
        });
        if (!result.ok) {
          return Response.json(
            { error: result.error },
            { status: result.status, headers: { "Cache-Control": "no-store" } },
          );
        }

        return Response.json(
          result.data,
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
