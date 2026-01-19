/**
 * Binary search to find the current symbol index based on timestamp.
 * O(log n) instead of O(n) linear search.
 */
export const findSymbol = (
  symbols: { timestamp: number }[],
  currentSeconds: number,
): number => {
  if (!symbols.length) return -1;

  const BUFFER = 0.05;
  const target = currentSeconds + BUFFER;

  let left = 0;
  let right = symbols.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midTime = symbols[mid].timestamp;

    if (midTime <= target) {
      result = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  if (result >= 0 && result < symbols.length) {
    const currentTime = symbols[result].timestamp;
    const nextTime =
      result + 1 < symbols.length ? symbols[result + 1].timestamp : Infinity;

    if (
      currentSeconds >= currentTime - BUFFER &&
      currentSeconds < nextTime - BUFFER
    ) {
      return result;
    }
  }

  return -1;
};
