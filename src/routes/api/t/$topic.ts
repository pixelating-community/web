import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";
import { getPerspectives } from "@/server/actions/getPerspectives";
import { getQRCode } from "@/server/actions/getQRCode";
import { getTopic } from "@/server/actions/getTopic";
import { isLocked } from "@/server/actions/isLocked";

const topicAuthHeaders = (requestId: string, headers?: HeadersInit) => {
  const next = requestIdHeaders(requestId, headers);
  next.set("Cache-Control", "private, no-store, max-age=0");
  next.set("Pragma", "no-cache");
  next.set("Vary", "Cookie");
  return next;
};

export const Route = createFileRoute("/api/t/$topic")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const requestId = getRequestId(request);
        const topicName = params.topic?.trim() ?? "";

        if (!topicName) {
          return Response.json(
            { error: "topic required" },
            { status: 400, headers: topicAuthHeaders(requestId) },
          );
        }

        const action =
          new URL(request.url).searchParams.get("action")?.trim() ?? "";

        const topic = await getTopic({ name: topicName });
        if (!topic?.id) {
          return Response.json(
            { error: "topic not found" },
            { status: 404, headers: topicAuthHeaders(requestId) },
          );
        }

        const topicId = String(topic.id);
        const canonicalTopicName = String(topic.name ?? topicName);
        const topicEmoji =
          typeof topic.emoji === "string" ? topic.emoji.trim() : "";
        const topicShortTitle =
          typeof topic.short_title === "string" ? topic.short_title.trim() : "";
        const locked = Boolean(await isLocked({ id: topicId }));
        const resolvedTokenCookie = resolveTopicTokenCookieFromRequest({
          request,
          topicId,
          topicName: canonicalTopicName,
        });
        const cookieToken = resolvedTokenCookie?.value;

        let validToken: string | undefined;
        if (cookieToken) {
          const validRows = await sql`
        SELECT token
        FROM topics
        WHERE id = ${topicId}
        LIMIT 1
      `;
          if (
            await verifyTopicToken(
              cookieToken,
              typeof validRows[0]?.token === "string"
                ? validRows[0].token
                : undefined,
            )
          ) {
            validToken = cookieToken;
          } else {
            console.warn("[topic-auth] Invalid token cookie on /api/t/$topic", {
              requestId,
              cookieName: resolvedTokenCookie?.name,
              topicId,
              topicName: canonicalTopicName,
            });
          }
        }
        const canWrite = locked ? Boolean(validToken) : true;
        const canAccess = locked ? canWrite : true;

        const perspectives =
          !locked || canAccess
            ? ((await getPerspectives({
                topicId,
                isLocked: locked,
                token: validToken,
                forward: true,
              })) ?? [])
            : [];

        const link = await getQRCode({
          path: `/t/${canonicalTopicName}${action ? `/${action}` : ""}`,
        });

        return Response.json(
          {
            topic: {
              id: topicId,
              name: canonicalTopicName,
              shortTitle: topicShortTitle || undefined,
              emoji: topicEmoji || undefined,
              locked,
              canAccess,
              canWrite,
            },
            perspectives,
            link,
          },
          { headers: topicAuthHeaders(requestId) },
        );
      },
    },
  },
});
