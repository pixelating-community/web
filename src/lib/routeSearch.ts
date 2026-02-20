const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export type TopicRouteSearch = {
  p?: string;
  r?: string;
  w?: string;
};

export const parseTopicRouteSearch = (
  search: Record<string, unknown>,
): TopicRouteSearch => ({
  p: normalizeOptionalString(search.p),
  r: normalizeOptionalString(search.r),
  w: normalizeOptionalString(search.w),
});

export type TopicUnlockSearch = {
  next?: string;
};

export const parseTopicUnlockSearch = (
  search: Record<string, unknown>,
): TopicUnlockSearch => ({
  next: normalizeOptionalString(search.next),
});
