import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { getTopicTokenCookieNames } from "@/lib/topicTokenCookies";

const schema = z.object({
  token: z.string().min(1),
  topicId: z.uuid(),
  topicName: z.string().min(1),
});

const buildCookie = ({
  name,
  value,
  path,
  secure,
}: {
  name: string;
  value: string;
  path: string;
  secure?: boolean;
}) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Strict",
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
};

export const Route = createFileRoute("/api/t/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request.headers);
        const requestId = getRequestId(request);
        const rate = rateLimit(`topic-token:${ip}`, 20, 60 * 1000);
        if (!rate.ok) {
          console.warn("[topic-auth] Rate limited /api/t/token", {
            requestId,
            ip,
          });
          return Response.json(
            { ok: false, error: "Too many requests" },
            {
              status: 429,
              headers: requestIdHeaders(requestId, rateLimitHeaders(rate)),
            },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          console.warn("[topic-auth] Invalid JSON on /api/t/token", {
            requestId,
            ip,
          });
          return Response.json(
            { ok: false, error: "Invalid JSON" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        let data: z.infer<typeof schema>;
        try {
          data = schema.parse(payload);
        } catch {
          console.warn("[topic-auth] Invalid input payload on /api/t/token", {
            requestId,
            ip,
          });
          return Response.json(
            { ok: false, error: "Invalid input" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const rows = await sql`
      SELECT token, name
      FROM topics
      WHERE id = ${data.topicId}
      LIMIT 1;
    `;

        const row =
          (rows[0] as { token?: unknown; name?: unknown } | undefined) ?? {};

        const storedToken =
          typeof row.token === "string" ? row.token : undefined;
        const canonicalTopicName =
          typeof row.name === "string" && row.name.trim().length > 0
            ? row.name.trim()
            : data.topicName;

        const isValid = await verifyTopicToken(data.token, storedToken);
        if (!isValid) {
          console.warn("[topic-auth] Incorrect token on /api/t/token", {
            requestId,
            topicId: data.topicId,
            topicName: canonicalTopicName,
            ip,
          });
          return Response.json(
            { ok: false, error: "Incorrect token" },
            { status: 401, headers: requestIdHeaders(requestId) },
          );
        }

        const headers = new Headers();
        const secure = new URL(request.url).protocol === "https:";
        const cookieNames = getTopicTokenCookieNames({
          topicId: data.topicId,
          topicName: canonicalTopicName,
        });
        for (const cookieName of cookieNames) {
          headers.append(
            "Set-Cookie",
            buildCookie({
              name: cookieName,
              value: data.token,
              path: "/",
              secure,
            }),
          );
        }

        return Response.json(
          { ok: true },
          { headers: requestIdHeaders(requestId, headers) },
        );
      },
    },
  },
});
