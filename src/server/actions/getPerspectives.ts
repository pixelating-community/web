import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { decrypt } from "@/lib/crypto";
import { sql } from "@/lib/db";
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
  collection_id: string | null;
  audio_src: string | null;
  start_time: number | null;
  end_time: number | null;
  symbols: unknown;
  rendered_html: string | null;
  words_json: string | null;
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
    // Keep legacy plaintext audio keys playable when old rows were stored unencrypted.
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
    // Keep legacy plaintext rows readable after lock migrations.
    return value;
  }
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
    let canAccess = !data.is_locked;
    if (data.is_locked && data.token) {
      const rows = await sql<TopicTokenRow>`
        SELECT token FROM topics WHERE id = ${data.topic_id} LIMIT 1;
      `;
      canAccess = await verifyTopicToken(
        data.token,
        typeof rows[0]?.token === "string" ? rows[0].token : undefined,
      );
    }

    const perspectives = data.forward
      ? await sql<PerspectiveRow>`SELECT p.id, perspective, p.topic_id, p.collection_id, p.audio_src, p.start_time, p.end_time, p.symbols, p.rendered_html, p.words_json
          FROM perspectives as p
          WHERE p.topic_id=${data.topic_id}
          ORDER BY p.id;`
      : await sql<PerspectiveRow>`SELECT p.id, perspective, p.topic_id, p.collection_id, p.audio_src, p.start_time, p.end_time, p.symbols, p.rendered_html, p.words_json
          FROM perspectives as p
          WHERE p.topic_id=${data.topic_id}
          ORDER BY p.id DESC;`;

    const results = [];
    for (const perspective of perspectives) {
      const plaintextPerspective =
        canAccess && data.is_locked
          ? decryptTextIfLocked({
              value: perspective.perspective,
              isLocked: Boolean(data.is_locked),
              token: data.token ?? undefined,
            })
          : perspective.perspective;
      let renderedHtml: string | null = null;
      let words: string[] = [];
      let wordTimings: WordTimingEntry[] = [];
      let decryptedStoredAudioSrc: string | null = null;

      if (canAccess) {
        const storedHtml = perspective.rendered_html ?? null;
        const storedAudioSrc = perspective.audio_src ?? null;
        const storedWords = perspective.words_json ?? null;
        let decryptedStoredHtml: string | null = null;
        decryptedStoredAudioSrc = decryptAudioSrcIfLocked({
          value: storedAudioSrc,
          isLocked: Boolean(data.is_locked),
          token: data.token ?? undefined,
        });
        if (storedHtml) {
          decryptedStoredHtml = decryptTextIfLocked({
            value: storedHtml,
            isLocked: Boolean(data.is_locked),
            token: data.token ?? undefined,
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
            isLocked: Boolean(data.is_locked),
            token: data.token ?? undefined,
          });
          wordTimings = normalizeTimings(wordsValue);
        }
      }

      results.push({
        id: perspective.id,
        perspective: plaintextPerspective,
        topic_id: perspective.topic_id,
        collection_id: perspective.collection_id,
        audio_src: canAccess
          ? resolveStoredAudioSrc(decryptedStoredAudioSrc)
          : null,
        start_time: canAccess ? (perspective.start_time ?? null) : null,
        end_time: canAccess ? (perspective.end_time ?? null) : null,
        symbols: canAccess ? (perspective.symbols ?? []) : [],
        rendered_html: canAccess ? renderedHtml : null,
        words: canAccess ? words : [],
        wordTimings: canAccess ? wordTimings : [],
      });
    }

    return results;
  } catch (e) {
    console.error("Failed to get perspectives", e);
  }
};
