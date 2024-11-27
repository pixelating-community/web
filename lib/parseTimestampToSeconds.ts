export const parseTimestampToSeconds = (timestamp: string): number => {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return minutes * 60 + seconds;
};
