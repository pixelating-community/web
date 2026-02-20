import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import {
  isTopicLockedMessage,
  resolveTopicWriteToken,
  TOPIC_LOCKED_RESPONSE,
} from "@/lib/topicWriteToken";
import { addPerspective } from "@/server/actions/addPerspective";

const schema = z.object({
  topicId: z.uuid(),
  name: z.string().min(1),
  perspective: z.string().min(1),
  token: z.string().min(1).optional(),
  hasAudioSrc: z.boolean().optional(),
  audioSrc: z.string().optional(),
});

export const Route = createFileRoute("/api/p")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip = getClientIp(request.headers);
        const requestId = getRequestId(request);
        const rate = rateLimit(`add-perspective:${ip}`, 20, 60 * 1000);
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

        let data: z.infer<typeof schema>;
        try {
          data = schema.parse(payload);
        } catch {
          return Response.json(
            { error: "Invalid input" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const formData = new FormData();
        formData.set("perspective", data.perspective);
        const resolvedToken = resolveTopicWriteToken({
          request,
          topicId: data.topicId,
          topicName: data.name,
          bodyToken: data.token,
        });
        if (resolvedToken) {
          formData.set("token", resolvedToken);
        }
        if (data.hasAudioSrc) {
          formData.set("audio_src", data.audioSrc?.trim() ?? "");
        }

        const result = await addPerspective({
          topicId: data.topicId,
          name: data.name,
          formData,
          requestId,
        });

        if (result?.message) {
          console.warn("[topic-auth] addPerspective failed", {
            requestId,
            topicId: data.topicId,
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
          { ok: true },
          { headers: requestIdHeaders(requestId) },
        );
      },
    },
  },
});
