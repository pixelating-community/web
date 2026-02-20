import { encrypt } from "@/lib/crypto";
import { sql } from "@/lib/db";
import {
  buildServerAudioUrl,
  getServerAudioBaseUrl,
} from "@/lib/publicAudioBase";
import { verifyTopicToken } from "@/lib/topicToken";
import type { WordTimingEntry } from "@/types/perspectives";

export type SaveTimingsArgs = {
  perspectiveId: string;
  timings: WordTimingEntry[];
  audioSrc?: string | null;
  duration?: number;
  token?: string;
  resolveToken?: (topicName: string, topicId: string) => string | undefined;
};

export class TimingsError extends Error {
  code: "NOT_FOUND" | "MISSING_TOKEN" | "INVALID_TOKEN" | "INVALID_AUDIO_SRC";

  constructor(
    code: "NOT_FOUND" | "MISSING_TOKEN" | "INVALID_TOKEN" | "INVALID_AUDIO_SRC",
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isAbsoluteHttpUrl = (value: string) =>
  value.startsWith("http://") || value.startsWith("https://");

const keyFromApiObjectUrl = (value: string) => {
  try {
    const url = new URL(
      value.startsWith("/") ? `https://localhost${value}` : value,
    );
    if (url.pathname !== "/api/obj") return null;
    const key = url.searchParams.get("key");
    return key ? decodeURIComponentSafe(key).trim() : null;
  } catch {
    return null;
  }
};

const keyFromManagedPublicUrl = (value: string) => {
  const base = getServerAudioBaseUrl();
  if (!base) return null;
  try {
    const baseUrl = new URL(base);
    const candidate = new URL(value);
    if (
      candidate.protocol !== baseUrl.protocol ||
      candidate.host !== baseUrl.host
    ) {
      return null;
    }
    const basePath = baseUrl.pathname.replace(/\/+$/, "");
    const candidatePath = candidate.pathname.replace(/\/+$/, "");
    const prefix = `${basePath}/`;
    if (!candidatePath.startsWith(prefix)) return null;
    const rawKey = candidatePath.slice(prefix.length);
    const normalized = decodeURIComponentSafe(rawKey).trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
};

const extractManagedAudioKey = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isAbsoluteHttpUrl(trimmed) || trimmed.startsWith("/")) {
    return keyFromApiObjectUrl(trimmed) ?? keyFromManagedPublicUrl(trimmed);
  }
  return trimmed;
};

const isSuccessfulAudioStatus = (status: number) =>
  (status >= 200 && status < 300) || status === 304;

const verifyManagedAudioKeyExists = async (key: string) => {
  const url = buildServerAudioUrl(key);

  try {
    const headRes = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
    });
    if (isSuccessfulAudioStatus(headRes.status)) {
      return true;
    }
    if (headRes.status === 404) {
      return false;
    }
  } catch {
    // fall through to ranged GET probe
  }

  try {
    const getRes = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-1" },
      redirect: "follow",
    });
    if (isSuccessfulAudioStatus(getRes.status)) {
      return true;
    }
    if (getRes.status === 404) {
      return false;
    }
  } catch {
    return false;
  }

  return false;
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const normalizeTimings = (value: unknown): WordTimingEntry[] => {
  const list = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();

  return list.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const raw = entry as Record<string, unknown>;
    const start =
      coerceNumber(raw.start) ??
      coerceNumber(raw.start_time) ??
      coerceNumber(raw.timestamp) ??
      coerceNumber(raw.time);
    if (start === null) return null;
    const end =
      coerceNumber(raw.end) ??
      coerceNumber(raw.end_time) ??
      coerceNumber(raw.stop);
    const word = typeof raw.word === "string" ? raw.word : undefined;
    return { start, end: end ?? undefined, word };
  });
};

export const savePerspectiveTimings = async ({
  perspectiveId,
  timings,
  audioSrc,
  duration,
  token,
  resolveToken,
}: SaveTimingsArgs) => {
  const hasAnyTimings = timings.some(Boolean);

  const rows = await sql`
    SELECT p.id, p.audio_src, p.start_time, p.end_time, p.topic_id, t.locked, t.token, t.name
    FROM perspectives p
    JOIN topics t ON t.id = p.topic_id
    WHERE p.id = ${perspectiveId}
    LIMIT 1;
  `;

  if (rows.length === 0) {
    throw new TimingsError("NOT_FOUND", "Perspective not found");
  }

  const row = rows[0];
  const isLocked = Boolean(row.locked);
  let authToken = token;

  if (!authToken && resolveToken) {
    authToken = resolveToken(
      typeof row.name === "string" ? row.name : "",
      typeof row.topic_id === "string" ? row.topic_id : "",
    );
  }

  if (!authToken && isLocked) {
    throw new TimingsError("MISSING_TOKEN", "Missing token");
  }
  if (authToken) {
    const isValid = await verifyTopicToken(
      authToken,
      typeof row.token === "string" ? row.token : undefined,
    );
    if (!isValid) {
      throw new TimingsError("INVALID_TOKEN", "Invalid token");
    }
  }

  const timingsJson = hasAnyTimings ? JSON.stringify(timings) : null;
  const storedTimings =
    hasAnyTimings && isLocked && authToken
      ? encrypt(timingsJson ?? "", authToken)
      : timingsJson;
  const timingBounds = hasAnyTimings
    ? timings.reduce(
        (bounds, entry) => {
          if (
            !entry ||
            typeof entry.start !== "number" ||
            !Number.isFinite(entry.start)
          ) {
            return bounds;
          }
          const start = Math.max(0, entry.start);
          const endCandidate =
            typeof entry.end === "number" && Number.isFinite(entry.end)
              ? Math.max(start, entry.end)
              : start;
          return {
            start:
              bounds.start === null ? start : Math.min(bounds.start, start),
            end:
              bounds.end === null
                ? endCandidate
                : Math.max(bounds.end, endCandidate),
          };
        },
        { end: null as number | null, start: null as number | null },
      )
    : { end: null as number | null, start: null as number | null };
  const durationBound =
    typeof duration === "number" && Number.isFinite(duration) && duration > 0
      ? duration
      : null;
  const existingStart =
    typeof row.start_time === "number" && Number.isFinite(row.start_time)
      ? row.start_time
      : null;
  const existingEnd =
    typeof row.end_time === "number" && Number.isFinite(row.end_time)
      ? row.end_time
      : null;
  const nextStart =
    durationBound !== null
      ? 0
      : hasAnyTimings
        ? timingBounds.start
        : existingStart;
  const nextEnd =
    durationBound !== null
      ? hasAnyTimings
        ? Math.max(durationBound, timingBounds.end ?? 0)
        : durationBound
      : hasAnyTimings
        ? timingBounds.end
        : existingEnd;
  const hasExplicitAudioSrc = audioSrc !== undefined;
  const nextAudioSrc = hasExplicitAudioSrc ? audioSrc : (row.audio_src ?? null);
  if (typeof audioSrc === "string" && audioSrc.trim().length > 0) {
    const managedKey = extractManagedAudioKey(audioSrc);
    if (managedKey) {
      const exists = await verifyManagedAudioKeyExists(managedKey);
      if (!exists) {
        throw new TimingsError(
          "INVALID_AUDIO_SRC",
          "Audio object does not exist or is not publicly readable",
        );
      }
    }
  }
  const storedAudioSrc =
    isLocked && authToken && typeof audioSrc === "string" && audioSrc.length > 0
      ? encrypt(audioSrc, authToken)
      : nextAudioSrc;

  await sql`
    UPDATE perspectives
    SET words_json = ${storedTimings},
        audio_src = ${storedAudioSrc},
        start_time = ${nextStart},
        end_time = ${nextEnd}
    WHERE id = ${row.id};
  `;

  return {
    timings: hasAnyTimings ? timings : [],
    audio_src: nextAudioSrc,
    start_time: nextStart,
    end_time: nextEnd,
  };
};
