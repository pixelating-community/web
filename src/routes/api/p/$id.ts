import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import {
  isTopicLockedMessage,
  resolveTopicWriteToken,
  TOPIC_LOCKED_RESPONSE,
} from "@/lib/topicWriteToken";
import { deletePerspective } from "@/server/actions/deletePerspective";
import { editPerspective } from "@/server/actions/editPerspective";
import { getTopic } from "@/server/actions/getTopic";

const putSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  perspective: z.string().min(1),
  token: z.string().min(1).optional(),
  hasAudioSrc: z.boolean().optional(),
  audioSrc: z.string().optional(),
});

const deleteSchema = z.object({
  id: z.uuid(),
  token: z.string().min(1).optional(),
});

export const Route = createFileRoute("/api/p/$id")({
  server: {
    handlers: {
      PUT: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const requestId = getRequestId(request);
        const rate = rateLimit(
          `edit-perspective:${ip}:${params.id}`,
          30,
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

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        let data: z.infer<typeof putSchema>;
        try {
          const payloadObject =
            typeof payload === "object" && payload !== null ? payload : {};
          data = putSchema.parse({ ...payloadObject, id: params.id });
        } catch {
          return Response.json(
            { error: "Invalid input" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const formData = new FormData();
        formData.set("perspective", data.perspective);
        const topic = await getTopic({ name: data.name });
        const canonicalTopicName =
          typeof topic?.name === "string" ? topic.name : data.name;
        const topicId = topic?.id ? String(topic.id) : undefined;
        const resolvedToken = resolveTopicWriteToken({
          request,
          topicName: canonicalTopicName,
          topicId,
          bodyToken: data.token,
        });
        if (resolvedToken) {
          formData.set("token", resolvedToken);
        }
        if (data.hasAudioSrc) {
          formData.set("audio_src", data.audioSrc?.trim() ?? "");
        }

        const result = await editPerspective({
          id: data.id,
          name: data.name,
          formData,
          requestId,
        });

        if (result.message) {
          console.warn("[topic-auth] editPerspective failed", {
            requestId,
            perspectiveId: data.id,
            topicName: data.name,
            message: result.message,
          });
          if (isTopicLockedMessage(result.message)) {
            return Response.json(
              { ...TOPIC_LOCKED_RESPONSE, requestId },
              { status: 401, headers: requestIdHeaders(requestId) },
            );
          }
          return Response.json(
            { error: result.message },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        return Response.json(
          { ok: true, result: result.result ?? null },
          { headers: requestIdHeaders(requestId) },
        );
      },

      DELETE: async ({ request, params }) => {
        const ip = getClientIp(request.headers);
        const requestId = getRequestId(request);
        const rate = rateLimit(
          `delete-perspective:${ip}:${params.id}`,
          20,
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

        let data: z.infer<typeof deleteSchema>;
        try {
          const payloadObject =
            typeof payload === "object" && payload !== null ? payload : {};
          data = deleteSchema.parse({ ...payloadObject, id: params.id });
        } catch {
          return Response.json(
            { error: "Invalid id" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const topicRows = await sql`
          SELECT t.id AS topic_id, t.name AS topic_name, t.token AS topic_token
          FROM perspectives p
          JOIN topics t ON t.id = p.topic_id
          WHERE p.id = ${data.id}
          LIMIT 1;
        `;
        if (topicRows.length === 0) {
          return Response.json(
            { error: "Perspective not found" },
            { status: 404, headers: requestIdHeaders(requestId) },
          );
        }

        const row = topicRows[0] as {
          topic_id?: unknown;
          topic_name?: unknown;
          topic_token?: unknown;
        };
        const topicId =
          typeof row.topic_id === "string" ? row.topic_id : undefined;
        const topicName =
          typeof row.topic_name === "string" ? row.topic_name : undefined;
        const resolvedToken = resolveTopicWriteToken({
          request,
          topicName,
          topicId,
          bodyToken: data.token,
        });
        const isValid = await verifyTopicToken(
          resolvedToken ?? "",
          typeof row.topic_token === "string" ? row.topic_token : undefined,
        );
        if (!resolvedToken || !isValid) {
          console.warn("[topic-auth] deletePerspective denied", {
            requestId,
            perspectiveId: data.id,
            topicId,
            topicName,
          });
          return Response.json(
            { ...TOPIC_LOCKED_RESPONSE, requestId },
            { status: 401, headers: requestIdHeaders(requestId) },
          );
        }

        await deletePerspective({ perspectiveId: data.id });
        return Response.json(
          { ok: true },
          { headers: requestIdHeaders(requestId) },
        );
      },
    },
  },
});
