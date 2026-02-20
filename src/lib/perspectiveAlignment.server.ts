import "@tanstack/react-start/server-only";
import * as z from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import { mergeAudioTracks } from "@/lib/audioMerge.server";
import { emitMergeComplete } from "@/lib/mergeEvents";
import { sql } from "@/lib/db.server";
import {
  normalizeTimings,
  savePerspectiveTimings,
  TimingsError,
} from "@/lib/perspectiveTimings";
import { getRequestId } from "@/lib/requestId";
import { resolveTopicTokenFromRequest } from "@/lib/topicTokenCookies";
import { extractR2Key } from "@/lib/publicAudioBase";
import { TOPIC_LOCKED_RESPONSE } from "@/lib/topicWriteToken";
import type { WordTimingEntry } from "@/types/perspectives";

const alignmentSchema = z.object({
  actionToken: z.string().min(1),
  audioKey: z.string().trim().min(1).optional(),
  audioUrl: z.string().url().optional(),
  clearAudio: z.boolean().optional(),
  duration: z.number().finite().positive().optional(),
  perspectiveId: z.uuid(),
  timings: z.array(z.any()).optional(),
  topicId: z.uuid(),
  voiceOffsetSeconds: z.number().finite().nonnegative().optional(),
});

type PerspectiveAlignmentResult =
  | {
      ok: true;
      data: {
        audio_src?: string | null;
        recording_src?: string | null;
        end_time?: number | null;
        merging?: boolean;
        start_time?: number | null;
        timings?: WordTimingEntry[];
      };
    }
  | { ok: false; error: string; code?: string; requestId: string };

const createFailure = ({
  requestId,
  error,
  code,
}: {
  requestId: string;
  error: string;
  code?: string;
}): PerspectiveAlignmentResult => ({
  ok: false,
  error,
  code,
  requestId,
});

export const savePerspectiveAlignmentServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof alignmentSchema>;
}): Promise<PerspectiveAlignmentResult> => {
  const requestId = getRequestId(request);
  const verified = verifyActionToken({
    token: data.actionToken,
    requiredScope: "perspective:align",
    topicId: data.topicId,
  });
  if (!verified) {
    return createFailure({
      requestId,
      error: "Unauthorized",
      code: "INVALID_ACTION_TOKEN",
    });
  }

  const perspectiveRows = await sql<{ topic_id: string }>`
    SELECT topic_id
    FROM perspectives
    WHERE id = ${data.perspectiveId}
    LIMIT 1;
  `;
  if (perspectiveRows.length === 0) {
    return createFailure({
      requestId,
      error: "Perspective not found",
    });
  }
  if (perspectiveRows[0]?.topic_id !== data.topicId) {
    return createFailure({
      requestId,
      error: "Unauthorized",
      code: "INVALID_ACTION_TOKEN",
    });
  }

  const timings = normalizeTimings(data.timings ?? []);
  const nextAudioSrc = data.clearAudio
    ? null
    : (data.audioKey ?? data.audioUrl ?? undefined);

  try {
    const result = await savePerspectiveTimings({
      perspectiveId: data.perspectiveId,
      timings,
      audioSrc: nextAudioSrc,
      duration: data.duration,
      resolveToken: (topicName, topicId) =>
        resolveTopicTokenFromRequest({
          request,
          topicName,
          topicId,
        }),
    });

    // Merge music + voice in the background — don't block the response
    if (
      typeof result.raw_recording_src === "string" &&
      result.raw_recording_src.trim().length > 0 &&
      typeof result.audio_src === "string" &&
      result.audio_src.trim().length > 0
    ) {
      const musicKey = extractR2Key(result.audio_src);
      const voiceKey = extractR2Key(result.raw_recording_src);
      if (!musicKey || !voiceKey) {
        console.warn("Background merge skipped: could not extract R2 keys", {
          audio_src: result.audio_src,
          raw_recording_src: result.raw_recording_src,
        });
      }
      const mergeArgs = {
        musicR2Key: musicKey ?? result.audio_src.trim(),
        voiceR2Key: voiceKey ?? result.raw_recording_src.trim(),
        voiceOffsetSeconds: data.voiceOffsetSeconds,
        perspectiveId: data.perspectiveId,
      };
      void (async () => {
        try {
          console.log("Background merge starting", mergeArgs);
          const mergeResult = await mergeAudioTracks(mergeArgs);
          if (mergeResult.ok) {
            await sql`
              UPDATE perspectives
              SET recording_src = ${mergeResult.r2Key}
              WHERE id = ${mergeArgs.perspectiveId};
            `;
            console.log("Background merge succeeded", { r2Key: mergeResult.r2Key, perspectiveId: mergeArgs.perspectiveId });
            emitMergeComplete(mergeArgs.perspectiveId, { status: "done", r2Key: mergeResult.r2Key });
          } else {
            console.error("Background merge failed", { error: mergeResult.error, perspectiveId: mergeArgs.perspectiveId });
            emitMergeComplete(mergeArgs.perspectiveId, { status: "error", error: mergeResult.error });
          }
        } catch (err) {
          console.error("Background merge error", err);
          emitMergeComplete(mergeArgs.perspectiveId, { status: "error", error: String(err) });
        }
      })();
    }

    const isMerging =
      typeof result.raw_recording_src === "string" &&
      result.raw_recording_src.trim().length > 0 &&
      typeof result.audio_src === "string" &&
      result.audio_src.trim().length > 0;

    return {
      ok: true,
      data: {
        timings: result.timings,
        audio_src:
          typeof result.audio_src === "string" || result.audio_src === null
            ? result.audio_src
            : undefined,
        recording_src:
          typeof result.recording_src === "string" || result.recording_src === null
            ? result.recording_src
            : undefined,
        start_time: result.start_time,
        end_time: result.end_time,
        merging: isMerging || undefined,
      },
    };
  } catch (error) {
    if (error instanceof TimingsError) {
      if (error.code === "MISSING_TOKEN" || error.code === "INVALID_TOKEN") {
        return createFailure({
          requestId,
          error: TOPIC_LOCKED_RESPONSE.error,
          code: TOPIC_LOCKED_RESPONSE.code,
        });
      }
      return createFailure({
        requestId,
        error: error.message,
      });
    }

    console.error(error, {
      message: "Failed to save perspective alignment",
      perspectiveId: data.perspectiveId,
      requestId,
    });
    return createFailure({
      requestId,
      error: "Failed to save timings",
    });
  }
};
