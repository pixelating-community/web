const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
    p: normalizeOptionalString(search.p),
    r: normalizeOptionalString(search.r),
    w: normalizeOptionalString(search.w),
    s,
    e: e !== undefined && s !== undefined && e < s ? undefined : e,
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
