import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { addPerspectiveCollection } from "@/server/actions/addPerspectiveCollection";
import { getCollection } from "@/server/actions/getCollection";

export const Route = createFileRoute("/api/c/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`collection:${ip}:${params.id}`, 60, 60 * 1000);
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            { status: 429, headers: rateLimitHeaders(rate) },
          );
        }

        const collection = await getCollection({ collectionId: params.id });
        return Response.json(collection);
      },

      POST: async ({ request, params }) => {
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
          const { id: perspectiveId } = body;
          const res = await addPerspectiveCollection({
            id: params.id,
            perspectiveId,
          });

          if (res?.id) {
            return Response.json(
              {
                success: true,
                message: `added collection:${res.collection?.id} to perspective:${res.id}`,
              },
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
