export const findLyric = (
  lyrics: { timestamp: number }[],
  currentSeconds: number,
): number | null => {
  const BUFFER = 0.05;

  for (let i = 0; i < lyrics.length; i++) {
    const currentLyricTime = lyrics[i].timestamp;
    const nextLyricTime =
      i + 1 < lyrics.length ? lyrics[i + 1].timestamp : Infinity;

    if (
      currentSeconds >= currentLyricTime - BUFFER &&
      currentSeconds < nextLyricTime - BUFFER
    ) {
      return i;
    }
  }

  return null;
};
