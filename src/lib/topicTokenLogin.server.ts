import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import { getRequestId } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { getTopicTokenCookieNames } from "@/lib/topicTokenCookies";

export const topicTokenLoginSchema = z.object({
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

export type SaveTopicTokenServerResult =
  | { ok: true; requestId: string; setCookieHeaders: string[] }
  | { ok: false; error: string; requestId: string; status: number };

export const saveTopicTokenServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof topicTokenLoginSchema>;
}): Promise<SaveTopicTokenServerResult> => {
  const ip = getClientIp(request.headers);
  const requestId = getRequestId(request);
  const rate = rateLimit(`topic-token:${ip}`, 20, 60 * 1000);
  if (!rate.ok) {
    console.warn("[topic-auth] Rate limited topic token login", {
      requestId,
      ip,
    });
    return { ok: false, error: "Too many requests", requestId, status: 429 };
  }

  const rows = await sql<{ token?: unknown; name?: unknown }>`
    SELECT token, name
    FROM topics
    WHERE id = ${data.topicId}
    LIMIT 1;
  `;

  const row = rows[0] ?? {};
  const storedToken = typeof row.token === "string" ? row.token : undefined;
  const canonicalTopicName =
    typeof row.name === "string" && row.name.trim().length > 0
      ? row.name.trim()
      : data.topicName;

  const isValid = await verifyTopicToken(data.token, storedToken);
  if (!isValid) {
    console.warn("[topic-auth] Incorrect token on topic token login", {
      requestId,
      topicId: data.topicId,
      topicName: canonicalTopicName,
      ip,
    });
    return { ok: false, error: "Incorrect token", requestId, status: 401 };
  }

  const secure = new URL(request.url).protocol === "https:";
  const setCookieHeaders = getTopicTokenCookieNames({
    topicId: data.topicId,
    topicName: canonicalTopicName,
  }).map((cookieName) =>
    buildCookie({
      name: cookieName,
      value: data.token,
      path: "/",
      secure,
    }),
  );

  return {
    ok: true,
    requestId,
    setCookieHeaders,
  };
};
