import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { addCollectionSession } from "@/server/actions/addCollectionSession";

const schema = z.object({
  id: z.uuid(),
  collectionId: z.uuid(),
});

export const Route = createFileRoute("/api/p/$id/collect")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const rate = rateLimit(`collect:${ip}:${params.id}`, 15, 60 * 1000);
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

        const result = await addCollectionSession({
          collectionId: data.collectionId,
          perspectiveId: data.id,
        });

        if (!result?.url) {
          return Response.json(
            { error: "Failed to create checkout session" },
            { status: 500 },
          );
        }

        return Response.json({ url: result.url });
      },
    },
  },
});
