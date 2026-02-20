import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  updatePerspectiveReflectionServer,
  updateReflectionSchema,
} from "@/lib/reflectionRoute.server";

export const Route = createFileRoute("/api/r/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(
          `edit-reflection:${ip}:${params.id}`,
          40,
          60 * 1000,
        );
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429, headers: rateLimitHeaders(rate) },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        let data: z.infer<typeof updateReflectionSchema>;
        try {
          const payloadObject =
            typeof payload === "object" && payload !== null ? payload : {};
          data = updateReflectionSchema.parse({ ...payloadObject, id: params.id });
        } catch {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        const result = await updatePerspectiveReflectionServer({
          request,
          data,
        });

        if (!result.ok) {
          return Response.json(
            { error: result.error },
            { status: result.status },
          );
        }

        return Response.json(result.data);
      },
    },
  },
});
