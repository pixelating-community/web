import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  createPerspectiveReflectionServer,
  createReflectionSchema,
} from "@/lib/reflectionRoute.server";

export const Route = createFileRoute("/api/p/$id/c")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        try {
          const ip = getClientIp(request.headers);
          const elKey = request.headers.get("x-el-key") ?? undefined;

          const limitKey = elKey ? `c:key:${ip}` : `c:${ip}:${params.id}`;
          const limit = elKey ? 10 : 30;
          const rate = rateLimit(limitKey, limit, 60 * 1000);
          if (!rate.ok) {
            return Response.json(
              { error: "Too many requests" },
              { status: 429, headers: rateLimitHeaders(rate) },
            );
          }

          const body = await request.json();
          const data = createReflectionSchema.parse({
            perspectiveId: params.id,
            reflectionId: body?.reflectionId,
            text: body?.text,
            elKey,
          });

          const result = await createPerspectiveReflectionServer({
            request,
            data,
          });

          if (result.ok) {
            return Response.json(result.data, { status: 201 });
          }
          return Response.json(
            { error: result.error },
            { status: result.status },
          );
        } catch {
          return Response.json(
            { error: "Failed to add reflection" },
            { status: 400 },
          );
        }
      },
    },
  },
});
