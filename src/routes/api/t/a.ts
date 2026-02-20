import { createFileRoute } from "@tanstack/react-router";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { addTopic } from "@/server/actions/addTopic";

const normalizeKey = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

export const Route = createFileRoute("/api/t/a")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          const bodyKey =
            typeof body?.key === "string" ? normalizeKey(body.key) : "";
          const headerToken = normalizeKey(request.headers.get("x-api-key"));
          const authorizationHeader = request.headers.get("authorization");
          const bearerMatch = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
          const bearerToken = normalizeKey(bearerMatch?.[1]);
          const authToken = headerToken || bearerToken || bodyKey;
          const adminKeys = [process.env.EL_KEY, process.env.TS_KEY]
            .map((value) => normalizeKey(value))
            .filter((value): value is string => value.length > 0);
          const enforceAdminKey = process.env.NODE_ENV === "production";
          if (enforceAdminKey) {
            if (adminKeys.length === 0) {
              return Response.json(
                { error: "Admin key is not configured" },
                { status: 500 },
              );
            }
            if (!adminKeys.includes(authToken)) {
              return Response.json({ error: "Unauthorized" }, { status: 401 });
            }
          }

          const { emoji, locked, name, overwrite, shortTitle, token } = body;
          const res = await addTopic({
            name,
            key: authToken,
            token,
            locked,
            overwrite,
            shortTitle,
            emoji,
          });

          if (res && "name" in res) {
            return Response.json(
              {
                success: true,
                created: res.created,
                message: res.created
                  ? `added topic: ${res.name}`
                  : `updated topic: ${res.name}`,
              },
              { status: 200 },
            );
          }
          const message =
            res &&
            typeof res === "object" &&
            "message" in res &&
            typeof res.message === "string"
              ? res.message
              : "Failed to add topic";
          return Response.json(
            { success: false, error: message },
            { status: 400 },
          );
        } catch (error) {
          return Response.json({ success: false, error }, { status: 400 });
        }
      },
    },
  },
});
