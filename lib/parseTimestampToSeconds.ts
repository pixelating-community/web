export const parseTimestampToSeconds = (
  timestamp: string
): number | undefined => {
  const parts = timestamp.split(/[:.]/).map(Number);

  if (parts.some(isNaN)) return undefined;

  const [minutes = 0, seconds = 0, milliseconds = 0] = parts;

  return (
    minutes * 60 +
    seconds +
    milliseconds / Math.pow(10, `${milliseconds}`.length)
  );
};
