export const parseTimestampToSeconds = (
  timestamp: string,
): number | undefined => {
  if (typeof timestamp === "number") {
    return timestamp;
  }
  const parts = timestamp.split(/[:.]/).map(Number);

  if (parts.some(Number.isNaN)) return undefined;

  const [minutes = 0, seconds = 0, milliseconds = 0] = parts;

  return minutes * 60 + seconds + milliseconds / 10 ** `${milliseconds}`.length;
};
