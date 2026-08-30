const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalSearchFlag = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (!(normalized.startsWith('"') && normalized.endsWith('"'))) {
    return normalized;
  }
  try {
    const parsed = JSON.parse(normalized);
    return normalizeOptionalString(parsed) ?? normalized;
  } catch {
    return normalized;
  }
};

const MIN_TIMESTAMP_RANGE_SECONDS = 0.2;

const normalizeFiniteTimestamp = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;

export const normalizeTimestampRangeEnd = ({
  end,
  start,
}: {
  end?: number | null;
  start?: number | null;
}) => {
  const normalizedEnd = normalizeFiniteTimestamp(end);
  if (normalizedEnd === undefined) return undefined;
  const normalizedStart = normalizeFiniteTimestamp(start);
  if (normalizedStart === undefined) return normalizedEnd;
  return normalizedEnd - normalizedStart > MIN_TIMESTAMP_RANGE_SECONDS
    ? normalizedEnd
    : undefined;
};

export const setTimestampSearchParams = ({
  end,
  params,
  start,
}: {
  end?: number | null;
  params: URLSearchParams;
  start?: number | null;
}) => {
  const normalizedStart = normalizeFiniteTimestamp(start);
  if (normalizedStart !== undefined) {
    params.set("s", String(normalizedStart));
  } else {
    params.delete("s");
  }

  const normalizedEnd = normalizeTimestampRangeEnd({
    end,
    start: normalizedStart,
  });
  if (normalizedEnd !== undefined) {
    params.set("e", String(normalizedEnd));
  } else {
    params.delete("e");
  }
};

const parseTimecode = (raw: string): number | undefined => {
  // Supports: "1.25", "0:01.25", "1:02.5", "01:25"
  const match = raw.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined;
  const total = minutes * 60 + seconds;
  return total >= 0 ? total : undefined;
};

const normalizeOptionalTimestamp = (value: unknown) => {
  if (value === undefined || value === null || value === "") return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  return parseTimecode(str);
};

export type TopicRouteSearch = {
  timingEditor?: string;
  p?: string;
  r?: string;
  w?: string;
  s?: number;
  e?: number;
  parent?: string;
  v?: string;
  i?: string;
};

export const parseTopicRouteSearch = (
  search: Record<string, unknown>,
): TopicRouteSearch => {
  const s = normalizeOptionalTimestamp(search.s);
  const e = normalizeOptionalTimestamp(search.e);
  return {
    timingEditor: normalizeOptionalSearchFlag(search.timingEditor),
    p: normalizeOptionalString(search.p),
    r: normalizeOptionalString(search.r),
    w: normalizeOptionalString(search.w),
    s,
    e: normalizeTimestampRangeEnd({ end: e, start: s }),
    parent: normalizeOptionalString(search.parent),
    v: normalizeOptionalString(search.v),
    i: normalizeOptionalString(search.i),
  };
};

export type TopicUnlockSearch = {
  next?: string;
};

export const parseTopicUnlockSearch = (
  search: Record<string, unknown>,
): TopicUnlockSearch => ({
  next: normalizeOptionalString(search.next),
});
