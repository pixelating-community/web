import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { decrypt } from "@/lib/crypto";
import { sql } from "@/lib/db.server";
import { normalizeSymbolList } from "@/lib/karaokePhrases";
import { normalizeTimings } from "@/lib/perspectiveTimings";
import { resolveStoredAudioSrc } from "@/lib/publicAudioBase";
import { verifyTopicToken } from "@/lib/topicToken";
import type { WordTimingEntry } from "@/types/perspectives";

type TopicTokenRow = {
  token: string | null;
};

type PerspectiveRow = {
  id: string;
  perspective: string | null;
  topic_id: string;
  parent_perspective_id: string | null;
  audio_src: string | null;
  image_src: string | null;
  video_src: string | null;
  recording_src: string | null;
  remix_audio_src: string | null;
  remix_duration: number | null;
  remix_updated_at: string | null;
  remix_waveform_json: unknown;
  start_time: number | null;
  end_time: number | null;
  symbols: unknown;
  rendered_html: string | null;
  words_json: string | null;
  reflection_count: number | null;
};

const decryptAudioSrcIfLocked = ({
  value,
  isLocked,
  token,
}: {
  value: string | null | undefined;
  isLocked: boolean;
  token?: string;
}) => {
  if (!value) return null;
  if (!isLocked || !token) return value;
  try {
    return decrypt(value, token);
  } catch {
    return value;
  }
};

const decryptTextIfLocked = ({
  value,
  isLocked,
  token,
}: {
  value: string | null | undefined;
  isLocked: boolean;
  token?: string;
}) => {
  if (!value) return value ?? null;
  if (!isLocked || !token) return value;
  try {
    return decrypt(value, token);
  } catch {
    return value;
  }
};

const processPerspectiveRows = ({
  rows,
  canAccess,
  isLocked,
  token,
}: {
  rows: PerspectiveRow[];
  canAccess: boolean;
  isLocked: boolean;
  token?: string;
}) => {
  const results = [];
  for (const perspective of rows) {
    const plaintextPerspective =
      canAccess && isLocked
        ? decryptTextIfLocked({
            value: perspective.perspective,
            isLocked,
            token,
          })
        : perspective.perspective;
    let renderedHtml: string | null = null;
    let words: string[] = [];
    let wordTimings: WordTimingEntry[] = [];
    let decryptedStoredAudioSrc: string | null = null;
    let decryptedStoredImageSrc: string | null = null;
    let decryptedStoredVideoSrc: string | null = null;
    let decryptedStoredRecordingSrc: string | null = null;
    let decryptedStoredRemixAudioSrc: string | null = null;

    if (canAccess) {
      const storedHtml = perspective.rendered_html ?? null;
      const storedAudioSrc = perspective.audio_src ?? null;
      const storedImageSrc = perspective.image_src ?? null;
      const storedVideoSrc = perspective.video_src ?? null;
      const storedRecordingSrc = perspective.recording_src ?? null;
      const storedRemixAudioSrc = perspective.remix_audio_src ?? null;
      const storedWords = perspective.words_json ?? null;
      decryptedStoredAudioSrc = decryptAudioSrcIfLocked({
        value: storedAudioSrc,
        isLocked,
        token,
      });
      decryptedStoredImageSrc = decryptAudioSrcIfLocked({
        value: storedImageSrc,
        isLocked,
        token,
      });
      decryptedStoredVideoSrc = decryptAudioSrcIfLocked({
        value: storedVideoSrc,
        isLocked,
        token,
      });
      decryptedStoredRecordingSrc = decryptAudioSrcIfLocked({
        value: storedRecordingSrc,
        isLocked,
        token,
      });
      decryptedStoredRemixAudioSrc = decryptAudioSrcIfLocked({
        value: storedRemixAudioSrc,
        isLocked,
        token,
      });
      if (storedHtml) {
        const decryptedStoredHtml = decryptTextIfLocked({
          value: storedHtml,
          isLocked,
          token,
        });
        renderedHtml = decryptedStoredHtml;
      }

      if (plaintextPerspective) {
        const compiled = compilePerspective(plaintextPerspective);
        renderedHtml = compiled.renderedHtml;
        words = compiled.words;
      }

      if (storedWords) {
        const wordsValue = decryptTextIfLocked({
          value: storedWords,
          isLocked,
          token,
        });
        wordTimings = normalizeTimings(wordsValue);
      }
    }

    results.push({
      id: perspective.id,
      perspective: plaintextPerspective,
      topic_id: perspective.topic_id,
      parent_perspective_id: perspective.parent_perspective_id ?? null,
      audio_src: canAccess
        ? resolveStoredAudioSrc(decryptedStoredAudioSrc)
        : null,
      image_src: canAccess
        ? resolveStoredAudioSrc(decryptedStoredImageSrc)
        : null,
      video_src: canAccess
        ? resolveStoredAudioSrc(decryptedStoredVideoSrc)
        : null,
      recording_src: canAccess
        ? resolveStoredAudioSrc(decryptedStoredRecordingSrc)
        : null,
      remix_audio_src: canAccess
        ? resolveStoredAudioSrc(decryptedStoredRemixAudioSrc)
        : null,
      remix_duration: canAccess ? (perspective.remix_duration ?? null) : null,
      remix_updated_at: canAccess
        ? (perspective.remix_updated_at ?? null)
        : null,
      remix_waveform:
        canAccess && Array.isArray(perspective.remix_waveform_json)
          ? perspective.remix_waveform_json
              .map((value) =>
                typeof value === "number" && Number.isFinite(value)
                  ? value
                  : null,
              )
              .filter((value): value is number => value !== null)
          : [],
      start_time: canAccess ? (perspective.start_time ?? null) : null,
      end_time: canAccess ? (perspective.end_time ?? null) : null,
      symbols: canAccess ? normalizeSymbolList(perspective.symbols) : [],
      rendered_html: canAccess ? renderedHtml : null,
      words: canAccess ? words : [],
      wordTimings: canAccess ? wordTimings : [],
      reflection_count: perspective.reflection_count ?? 0,
    });
  }
  return results;
};

const resolveTopicAccess = async ({
  topicId,
  isLocked,
  token,
}: {
  topicId: string;
  isLocked?: boolean;
  token?: string;
}) => {
  let canAccess = !isLocked;
  if (isLocked && token) {
    const rows = await sql<TopicTokenRow>`
      SELECT token FROM topics WHERE id = ${topicId} LIMIT 1;
    `;
    canAccess = await verifyTopicToken(
      token,
      typeof rows[0]?.token === "string" ? rows[0].token : undefined,
    );
  }
  return canAccess;
};

export const getPerspectives = async ({
  topicId,
  isLocked,
  token,
  forward,
}: {
  topicId: string;
  isLocked?: boolean;
  token?: string;
  forward?: boolean;
}) => {
  try {
    const schema = z.object({
      topic_id: z.uuid(),
      is_locked: z.boolean().nullish(),
      token: z.string().min(1).nullish(),
      forward: z.boolean().nullish(),
    });
    const data = schema.parse({
      topic_id: topicId,
      is_locked: isLocked,
      token: token,
      forward: forward,
    });
    const canAccess = await resolveTopicAccess({
      topicId: data.topic_id,
      isLocked: Boolean(data.is_locked),
      token: data.token ?? undefined,
    });

    const rows = data.forward
      ? await sql<PerspectiveRow>`SELECT p.id, perspective, p.topic_id, p.parent_perspective_id, p.audio_src, p.image_src, p.video_src, p.recording_src, p.remix_audio_src, p.remix_duration, p.remix_updated_at, p.remix_waveform_json, p.start_time, p.end_time, p.symbols, p.rendered_html, p.words_json, (SELECT count(*) FROM perspectives c WHERE c.parent_perspective_id = p.id)::int AS reflection_count
          FROM perspectives as p
          WHERE p.topic_id=${data.topic_id} AND p.parent_perspective_id IS NULL
          ORDER BY p.id;`
      : await sql<PerspectiveRow>`SELECT p.id, perspective, p.topic_id, p.parent_perspective_id, p.audio_src, p.image_src, p.video_src, p.recording_src, p.remix_audio_src, p.remix_duration, p.remix_updated_at, p.remix_waveform_json, p.start_time, p.end_time, p.symbols, p.rendered_html, p.words_json, (SELECT count(*) FROM perspectives c WHERE c.parent_perspective_id = p.id)::int AS reflection_count
          FROM perspectives as p
          WHERE p.topic_id=${data.topic_id} AND p.parent_perspective_id IS NULL
          ORDER BY p.id DESC;`;

    return processPerspectiveRows({
      rows,
      canAccess,
      isLocked: Boolean(data.is_locked),
      token: data.token ?? undefined,
    });
  } catch (e) {
    console.error("Failed to get perspectives", e);
  }
};

export const getChildPerspectives = async ({
  parentPerspectiveId,
  isLocked,
  token,
}: {
  parentPerspectiveId: string;
  isLocked?: boolean;
  token?: string;
}) => {
  try {
    const parentId = z.uuid().parse(parentPerspectiveId);

    const parentRows = await sql<{ topic_id: string }>`
      SELECT topic_id FROM perspectives WHERE id = ${parentId} LIMIT 1;
    `;
    const topicId = parentRows[0]?.topic_id;
    if (!topicId) return [];

    const canAccess = await resolveTopicAccess({
      topicId,
      isLocked: Boolean(isLocked),
      token,
    });

    const rows = await sql<PerspectiveRow>`SELECT p.id, perspective, p.topic_id, p.parent_perspective_id, p.audio_src, p.image_src, p.video_src, p.recording_src, p.remix_audio_src, p.remix_duration, p.remix_updated_at, p.remix_waveform_json, p.start_time, p.end_time, p.symbols, p.rendered_html, p.words_json, (SELECT count(*) FROM perspectives c WHERE c.parent_perspective_id = p.id)::int AS reflection_count
      FROM perspectives as p
      WHERE p.parent_perspective_id = ${parentId}
      ORDER BY p.id;`;

    return processPerspectiveRows({
      rows,
      canAccess,
      isLocked: Boolean(isLocked),
      token,
    });
  } catch (e) {
    console.error("Failed to get child perspectives", e);
    return [];
  }
};
