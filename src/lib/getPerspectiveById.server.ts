import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { decrypt } from "@/lib/crypto";
import { sql } from "@/lib/db.server";
import { normalizeSymbolList } from "@/lib/karaokePhrases";
import { normalizeTimings } from "@/lib/perspectiveTimings";
import { resolveStoredAudioSrc } from "@/lib/publicAudioBase";
import { verifyTopicToken } from "@/lib/topicToken";

type PerspectiveWithTopicRow = {
  id: string;
  perspective: string | null;
  topic_id: string;
  parent_perspective_id: string | null;
  audio_src: string | null;
  image_src: string | null;
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
  topic_locked: boolean | null;
  topic_token: string | null;
};

const decryptIfLocked = (value: string | null, isLocked: boolean, token?: string) => {
  if (!value || !isLocked || !token) return value;
  try { return decrypt(value, token); } catch { return value; }
};

export const getPerspectiveById = async ({
  perspectiveId,
  cookieToken,
}: {
  perspectiveId: string;
  cookieToken?: string;
}) => {
  try {
    const id = z.uuid().parse(perspectiveId);

    const rows = await sql<PerspectiveWithTopicRow>`
      SELECT p.id, p.perspective, p.topic_id, p.parent_perspective_id,
        p.audio_src, p.image_src, p.recording_src, p.remix_audio_src, p.remix_duration,
        p.remix_updated_at, p.remix_waveform_json, p.start_time, p.end_time,
        p.symbols, p.rendered_html, p.words_json,
        t.locked AS topic_locked, t.token AS topic_token
      FROM perspectives AS p
      JOIN topics AS t ON t.id = p.topic_id
      WHERE p.id = ${id}
      LIMIT 1;
    `;
    const row = rows[0];
    if (!row) return null;

    const isLocked = Boolean(row.topic_locked);
    const storedToken = typeof row.topic_token === "string" ? row.topic_token : undefined;
    let canAccess = !isLocked;
    if (isLocked && cookieToken && storedToken) {
      canAccess = await verifyTopicToken(cookieToken, storedToken);
    }
    if (!canAccess) return null;

    const token = cookieToken;
    const text = decryptIfLocked(row.perspective, isLocked, token);
    let renderedHtml: string | null = decryptIfLocked(row.rendered_html, isLocked, token);
    let words: string[] = [];
    if (text) {
      const compiled = compilePerspective(text);
      renderedHtml = compiled.renderedHtml;
      words = compiled.words;
    }
    const wordTimings = row.words_json
      ? normalizeTimings(decryptIfLocked(row.words_json, isLocked, token))
      : [];

    return {
      id: row.id,
      perspective: text,
      topic_id: row.topic_id,
      parent_perspective_id: row.parent_perspective_id ?? null,
      audio_src: resolveStoredAudioSrc(decryptIfLocked(row.audio_src, isLocked, token)),
      image_src: resolveStoredAudioSrc(decryptIfLocked(row.image_src, isLocked, token)),
      recording_src: resolveStoredAudioSrc(decryptIfLocked(row.recording_src, isLocked, token)),
      remix_audio_src: resolveStoredAudioSrc(decryptIfLocked(row.remix_audio_src, isLocked, token)),
      remix_duration: row.remix_duration ?? null,
      remix_updated_at: row.remix_updated_at ?? null,
      remix_waveform:
        Array.isArray(row.remix_waveform_json)
          ? row.remix_waveform_json.filter(
              (v): v is number => typeof v === "number" && Number.isFinite(v),
            )
          : [],
      start_time: row.start_time ?? null,
      end_time: row.end_time ?? null,
      symbols: normalizeSymbolList(row.symbols),
      rendered_html: renderedHtml,
      words,
      wordTimings,
    };
  } catch (e) {
    console.error("Failed to get perspective by id", e);
    return null;
  }
};
