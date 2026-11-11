export type VideoContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Detect substantial, symmetric black padding, leaving ordinary dark scenes intact. */
export function detectVideoContentBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): VideoContentBounds {
  const full = { x: 0, y: 0, width, height };
  const isBlack = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) <= 24;
  };
  const columnIsBlack = (x: number) => {
    let black = 0;
    for (let y = 0; y < height; y++) if (isBlack(x, y)) black++;
    return black >= height * 0.98;
  };
  const rowIsBlack = (y: number) => {
    let black = 0;
    for (let x = 0; x < width; x++) if (isBlack(x, y)) black++;
    return black >= width * 0.98;
  };
  let left = 0;
  let right = width - 1;
  while (left < right && columnIsBlack(left)) left++;
  while (right > left && columnIsBlack(right)) right--;
  let top = 0;
  let bottom = height - 1;
  while (top < bottom && rowIsBlack(top)) top++;
  while (bottom > top && rowIsBlack(bottom)) bottom--;

  const horizontalPadding = Math.min(left, width - 1 - right);
  const verticalPadding = Math.min(top, height - 1 - bottom);
  const symmetricSides = Math.abs(left - (width - 1 - right)) <= width * 0.025;
  const symmetricEnds = Math.abs(top - (height - 1 - bottom)) <= height * 0.025;
  // A black frame or a small moving light is insufficient evidence of padding.
  if (right - left < width * 0.2 || bottom - top < height * 0.2) return full;
  const x =
    symmetricSides && horizontalPadding >= width * 0.04
      ? horizontalPadding + 1
      : 0;
  const y =
    symmetricEnds && verticalPadding >= height * 0.04 ? verticalPadding + 1 : 0;
  return { x, y, width: width - 2 * x, height: height - 2 * y };
}
