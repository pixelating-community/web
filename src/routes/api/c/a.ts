import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { addCollection } from "@/server/actions/addCollection";

export const Route = createFileRoute("/api/c/a")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-api-key") ?? "";
        if (!process.env.EL_KEY || token !== process.env.EL_KEY) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ip = getClientIp(request.headers);
        const rate = rateLimit(`admin:${ip}`, 10, 60 * 1000);
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429, headers: rateLimitHeaders(rate) },
          );
        }

        try {
          const body = await request.json();
          const { name, description, total } = body;
          const res = await addCollection({ name, description, total });

          if (res?.id) {
            return Response.json(
              { success: true, message: `added collection: ${res.id}` },
              { status: 201 },
            );
          }
          return Response.json(
            {
              success: false,
              error: res,
              status: 400,
            },
            { status: 400 },
          );
        } catch (error) {
          return Response.json({ success: false, error }, { status: 400 });
        }
      },
    },
  },
});
