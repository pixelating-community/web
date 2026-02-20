import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { editReflection } from "@/server/actions/editReflection";
import { getRequestCookie } from "@/server/lib/requestCookies";

const schema = z.object({
  id: z.uuid(),
  text: z.string().min(1).max(5000),
});

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

        let data: z.infer<typeof schema>;
        try {
          const payloadObject =
            typeof payload === "object" && payload !== null ? payload : {};
          data = schema.parse({ ...payloadObject, id: params.id });
        } catch {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        const result = await editReflection({
          id: data.id,
          text: data.text,
          cookieStore: {
            get: (name) => {
              const value = getRequestCookie(request, name);
              return value === undefined ? undefined : { value };
            },
          },
        });

        if (!result) {
          return Response.json(
            { error: "Unable to edit reflection" },
            { status: 401 },
          );
        }

        return Response.json(result);
      },
    },
  },
});
