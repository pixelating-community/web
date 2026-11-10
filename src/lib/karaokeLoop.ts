export const resolveKaraokeLoop = (
  start?: number,
  end?: number,
  duration?: number,
) => {
  if (
    start === undefined ||
    end === undefined ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0
  )
    return null;
  const upper =
    duration !== undefined && Number.isFinite(duration) && duration > 0
      ? Math.min(end, duration)
      : end;
  return upper > start ? { start, end: upper } : null;
};
