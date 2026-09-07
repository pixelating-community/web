import { createFileRoute } from "@tanstack/react-router";
import { createTopicOwnerInviteSchema } from "@/lib/creatorSupport.schema";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";

const normalizeKey = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

export const Route = createFileRoute("/api/obj/topic-owner-invites")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request.headers);
        const requestId = getRequestId(request);
        const rate = rateLimit(`topic-owner-invite:${ip}`, 10, 60 * 60_000);
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests", requestId },
            {
              status: 429,
              headers: requestIdHeaders(requestId, rateLimitHeaders(rate)),
            },
          );
        }

        const authorization = request.headers.get("authorization");
        const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
        const suppliedKey = normalizeKey(
          request.headers.get("x-api-key") || bearer,
        );
        const adminKeys = [process.env.EL_KEY, process.env.TS_KEY]
          .map((value) => normalizeKey(value))
          .filter(Boolean);
        if (
          process.env.NODE_ENV === "production" &&
          (adminKeys.length === 0 || !adminKeys.includes(suppliedKey))
        ) {
          return Response.json(
            { error: "Unauthorized", requestId },
            { status: 401, headers: requestIdHeaders(requestId) },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON", requestId },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }
        const parsed = createTopicOwnerInviteSchema.safeParse(payload);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid input", requestId },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const { createTopicOwnerInviteServer } =
          await import("@/lib/creatorSupport.server");
        const result = await createTopicOwnerInviteServer({
          data: parsed.data,
          request,
        });
        if (!result.ok) {
          return Response.json(
            { error: result.error, requestId },
            { status: result.status, headers: requestIdHeaders(requestId) },
          );
        }
        return Response.json(
          { ...result.data, requestId },
          {
            headers: requestIdHeaders(requestId, {
              "Cache-Control": "no-store",
            }),
          },
        );
      },
    },
  },
});
