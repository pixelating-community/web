import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import { deleteTopic } from "@/lib/deleteTopic.server";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import {
  resolveTopicWriteToken,
  TOPIC_LOCKED_RESPONSE,
} from "@/lib/topicWriteToken";
import {
  resolveStoredTopicToken,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";
import { getTopicPayload } from "@/lib/getTopicPayload.server";

const topicAuthHeaders = (requestId: string, headers?: HeadersInit) => {
  const next = requestIdHeaders(requestId, headers);
  next.set("Cache-Control", "private, no-store, max-age=0");
  next.set("Pragma", "no-cache");
  next.set("Vary", "Cookie");
  return next;
};

const deleteBodySchema = z.object({
  token: z.string().min(1).optional(),
});

export const Route = createFileRoute("/api/t/$topic")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const requestId = getRequestId(request);
        const topicName = (params.topic ?? "").split("?")[0].trim();
        const result = await getTopicPayload({
          request,
          topicName,
        });

        if (result.data) {
          return Response.json(result.data, {
            headers: topicAuthHeaders(requestId),
          });
        }

        const status =
          result.error === "topic required"
            ? 400
            : result.error === "topic not found"
              ? 404
              : 500;

        return Response.json(
          { error: result.error },
          { status, headers: topicAuthHeaders(requestId) },
        );
      },

      DELETE: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const requestId = getRequestId(request);
        const topicName = (params.topic ?? "").split("?")[0].trim();

        if (!topicName) {
          return Response.json(
            { error: "Topic name required" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const rate = rateLimit(
          `delete-topic:${ip}:${topicName}`,
          5,
          60 * 1000,
        );
        if (!rate.ok) {
          return Response.json(
            { error: "Too many requests" },
            {
              status: 429,
              headers: requestIdHeaders(requestId, rateLimitHeaders(rate)),
            },
          );
        }

        let payload: unknown = {};
        try {
          const contentType = request.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            payload = await request.json();
          }
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        let data: z.infer<typeof deleteBodySchema>;
        try {
          const payloadObject =
            typeof payload === "object" && payload !== null ? payload : {};
          data = deleteBodySchema.parse(payloadObject);
        } catch {
          return Response.json(
            { error: "Invalid request body" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const topicRows = await sql`
          SELECT id, name, token, locked
          FROM topics
          WHERE name = ${topicName}
          LIMIT 1;
        `;
        if (topicRows.length === 0) {
          return Response.json(
            { error: "Topic not found" },
            { status: 404, headers: requestIdHeaders(requestId) },
          );
        }

        const row = topicRows[0] as {
          id?: unknown;
          name?: unknown;
          token?: unknown;
          locked?: unknown;
        };
        const topicId =
          typeof row.id === "string" ? row.id : undefined;
        const resolvedName =
          typeof row.name === "string" ? row.name : undefined;
        const storedTopicToken = resolveStoredTopicToken(
          typeof row.token === "string" ? row.token : undefined,
        );
        const requiresWriteToken = topicRequiresWriteToken({
          locked: Boolean(row.locked),
          storedToken: storedTopicToken,
        });
        const resolvedToken = resolveTopicWriteToken({
          request,
          topicName: resolvedName,
          topicId,
          bodyToken: data.token,
        });
        const isValid =
          requiresWriteToken && resolvedToken
            ? await verifyTopicToken(resolvedToken, storedTopicToken)
            : false;
        if (requiresWriteToken && (!resolvedToken || !isValid)) {
          console.warn("[topic-auth] deleteTopic denied", {
            requestId,
            topicId,
            topicName,
          });
          return Response.json(
            { ...TOPIC_LOCKED_RESPONSE, requestId },
            { status: 401, headers: requestIdHeaders(requestId) },
          );
        }

        if (!topicId) {
          return Response.json(
            { error: "Topic not found" },
            { status: 404, headers: requestIdHeaders(requestId) },
          );
        }

        await deleteTopic({ topicId });
        return Response.json(
          { ok: true },
          { headers: requestIdHeaders(requestId) },
        );
      },
    },
  },
});
