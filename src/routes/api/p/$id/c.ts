import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { addReflection } from "@/server/actions/addReflection";
import { getRequestCookie } from "@/server/lib/requestCookies";

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
          const { reflectionId, text } = body;

          const newReflection = await addReflection({
            perspectiveId: params.id,
            reflectionId,
            text,
            elKey,
            cookieStore: {
              get: (name) => {
                const value = getRequestCookie(request, name);
                return value === undefined ? undefined : { value };
              },
              delete: () => {},
            },
          });

          if (newReflection) {
            return Response.json(newReflection, { status: 201 });
          }
          return Response.json(
            { error: "Failed to add reflection" },
            { status: 400 },
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
