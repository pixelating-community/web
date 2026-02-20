import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { issueActionToken } from "@/lib/actionToken.server";
import { TOPIC_UI_ACTION_SCOPES } from "@/lib/actionToken";
import { compilePerspective } from "@/lib/compilePerspective";
import { sql } from "@/lib/db.server";
import { normalizeTimings } from "@/lib/perspectiveTimings";
import { resolveStoredAudioSrc } from "@/lib/publicAudioBase";
import { getRequestId } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";
import {
  resolveStoredTopicToken,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";
import type { Perspective } from "@/types/perspectives";

export type PromptResponse = {
  perspectives: Perspective[];
  initialPerspectiveId: string;
  topicId: string;
  topicName: string;
  canWrite: boolean;
  topicShortTitle?: string;
  topicEmoji?: string;
  actionToken?: string;
};

export type PerspectiveRouteLoaderData = {
  data: PromptResponse | null;
  error: string;
};

export const loadPerspectivePayloadServer = async ({
  id,
  request,
}: {
  id: string;
  request?: Request;
}): Promise<PerspectiveRouteLoaderData> => {
  const schema = z.object({ id: z.uuid() });
  let parsed: { id: string };

  try {
    parsed = schema.parse({ id });
  } catch {
    return { data: null, error: "Invalid id" };
  }

  try {
    const rows = await sql<{
      id: string;
      perspective: string;
      topic_id: string;
      topic_name: string;
      topic_token?: string | null;
      topic_locked?: boolean | null;
      topic_short_title?: string | null;
      topic_emoji?: string | null;
      rendered_html?: string | null;
      words_json?: string | null;
      audio_src?: string | null;
      recording_src?: string | null;
      remix_audio_src?: string | null;
      remix_duration?: number | null;
      remix_updated_at?: string | null;
      remix_waveform_json?: unknown;
      start_time?: number | null;
      end_time?: number | null;
    }>`
      SELECT
        p.id,
        p.perspective,
        p.topic_id,
        t.name AS topic_name,
        t.token AS topic_token,
        t.locked AS topic_locked,
        t.short_title AS topic_short_title,
        t.emoji AS topic_emoji,
        p.rendered_html,
        p.words_json,
        p.audio_src,
        p.recording_src,
        p.remix_audio_src,
        p.remix_duration,
        p.remix_updated_at,
        p.remix_waveform_json,
        p.start_time,
        p.end_time
      FROM perspectives AS p
      JOIN topics AS t ON t.id = p.topic_id
      WHERE p.id = ${parsed.id}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return { data: null, error: "Perspective not found" };
    }

    const row = rows[0];
    const compiled = compilePerspective(String(row.perspective ?? ""));
    const wordTimings = normalizeTimings(row.words_json ?? null);
    const perspective: Perspective = {
      id: row.id as Perspective["id"],
      perspective: String(row.perspective ?? ""),
      topic_id: row.topic_id as Perspective["topic_id"],
      rendered_html: compiled.renderedHtml,
      words: compiled.words,
      wordTimings,
      audio_src: resolveStoredAudioSrc(row.audio_src) ?? undefined,
      recording_src: resolveStoredAudioSrc(row.recording_src) ?? undefined,
      remix_audio_src: resolveStoredAudioSrc(row.remix_audio_src) ?? undefined,
      remix_duration: row.remix_duration ?? undefined,
      remix_updated_at: row.remix_updated_at ?? undefined,
      remix_waveform: Array.isArray(row.remix_waveform_json)
        ? row.remix_waveform_json
            .map((value) =>
              typeof value === "number" && Number.isFinite(value)
                ? value
                : null,
            )
            .filter((value): value is number => value !== null)
        : undefined,
      start_time: row.start_time ?? undefined,
      end_time: row.end_time ?? undefined,
    };

    const isLocked = Boolean(row.topic_locked);
    const storedTopicToken = resolveStoredTopicToken(
      typeof row.topic_token === "string" ? row.topic_token : undefined,
    );
    const requiresWriteToken = topicRequiresWriteToken({
      locked: isLocked,
      storedToken: storedTopicToken,
    });
    let canWrite = !requiresWriteToken;
    const requestId = request ? getRequestId(request) : "server-fn";

    if (requiresWriteToken && request) {
      const resolvedTokenCookie = resolveTopicTokenCookieFromRequest({
        request,
        topicId: row.topic_id,
        topicName: row.topic_name,
      });
      canWrite = await verifyTopicToken(
        resolvedTokenCookie?.value ?? "",
        storedTopicToken,
      );
    }
    const actionToken = canWrite
      ? issueActionToken({
          scopes: TOPIC_UI_ACTION_SCOPES,
          topicId: perspective.topic_id,
          requestId,
        })
      : null;

    return {
      data: {
        perspectives: [perspective],
        initialPerspectiveId: perspective.id,
        topicId: perspective.topic_id,
        topicName: row.topic_name,
        canWrite,
        topicShortTitle: row.topic_short_title ?? undefined,
        topicEmoji: row.topic_emoji ?? undefined,
        actionToken: actionToken ?? undefined,
      },
      error: "",
    };
  } catch (error) {
    console.error(error, { message: "Failed to load perspective payload" });
    return { data: null, error: "Failed to load perspective" };
  }
};
