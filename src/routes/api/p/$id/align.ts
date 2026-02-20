import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import {
  normalizeTimings,
  savePerspectiveTimings,
  TimingsError,
} from "@/lib/perspectiveTimings";
import { getRequestId, requestIdHeaders } from "@/lib/requestId";
import { resolveTopicTokenFromRequest } from "@/lib/topicTokenCookies";
import { TOPIC_LOCKED_RESPONSE } from "@/lib/topicWriteToken";

export const Route = createFileRoute("/api/p/$id/align")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const requestId = getRequestId(request);
        const schema = z.object({
          id: z.uuid(),
          audioKey: z.string().min(1).optional(),
          audioUrl: z.string().url().optional(),
          clearAudio: z.boolean().optional(),
          duration: z.number().finite().positive().optional(),
          token: z.string().min(1).optional(),
          timings: z.array(z.any()).optional(),
        });

        let payload: {
          audioKey?: string;
          audioUrl?: string;
          clearAudio?: boolean;
          duration?: number;
          token?: string;
          timings?: unknown[];
        };
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "Invalid JSON" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        let data: {
          id: string;
          audioKey?: string;
          audioUrl?: string;
          clearAudio?: boolean;
          duration?: number;
          token?: string;
          timings?: unknown[];
        };
        try {
          data = schema.parse({ id: params.id, ...payload });
        } catch {
          return Response.json(
            { error: "Invalid input" },
            { status: 400, headers: requestIdHeaders(requestId) },
          );
        }

        const timings = normalizeTimings(data.timings ?? []);
        const nextAudioSrc = data.clearAudio
          ? null
          : (data.audioKey ?? data.audioUrl ?? undefined);

        try {
          const result = await savePerspectiveTimings({
            perspectiveId: data.id,
            timings,
            audioSrc: nextAudioSrc,
            duration: data.duration,
            token: data.token,
            resolveToken: (topicName, topicId) =>
              resolveTopicTokenFromRequest({
                request,
                topicName,
                topicId,
              }),
          });
          return Response.json(
            {
              ok: true,
              timings: result.timings,
              audio_src: result.audio_src,
              start_time: result.start_time,
              end_time: result.end_time,
            },
            { headers: requestIdHeaders(requestId) },
          );
        } catch (err) {
          if (err instanceof TimingsError) {
            console.warn("[timings] savePerspectiveTimings error", {
              requestId,
              code: err.code,
              message: err.message,
              perspectiveId: data.id,
              hasToken: Boolean(data.token),
              hasTimings: timings.some(Boolean),
              hasAudioSrc: data.clearAudio || Boolean(nextAudioSrc),
            });
            if (err.code === "NOT_FOUND") {
              return Response.json(
                { error: err.message },
                { status: 404, headers: requestIdHeaders(requestId) },
              );
            }
            if (err.code === "MISSING_TOKEN" || err.code === "INVALID_TOKEN") {
              return Response.json(
                { ...TOPIC_LOCKED_RESPONSE, requestId },
                { status: 401, headers: requestIdHeaders(requestId) },
              );
            }
            if (err.code === "INVALID_AUDIO_SRC") {
              return Response.json(
                { error: err.message },
                { status: 400, headers: requestIdHeaders(requestId) },
              );
            }
          }
          console.error(err, { requestId, perspectiveId: data.id });
          return Response.json(
            { error: "Failed to save timings" },
            { status: 500, headers: requestIdHeaders(requestId) },
          );
        }
      },
    },
  },
});
