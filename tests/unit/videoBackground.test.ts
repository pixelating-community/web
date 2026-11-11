import { describe, expect, it } from "vitest";
import { detectVideoContentBounds } from "@/lib/videoBackground";

function frame(
  width: number,
  height: number,
  content: { x: number; y: number; width: number; height: number },
) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = content.y; y < content.y + content.height; y++) {
    for (let x = content.x; x < content.x + content.width; x++) {
      const index = (y * width + x) * 4;
      pixels[index] = 140;
      pixels[index + 1] = 90;
      pixels[index + 2] = 180;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

describe("video background padding", () => {
  it("removes the embedded pillarboxing around portrait footage", () => {
    const pixels = frame(320, 180, { x: 110, y: 0, width: 100, height: 180 });
    expect(detectVideoContentBounds(pixels, 320, 180)).toEqual({
      x: 111,
      y: 0,
      width: 98,
      height: 180,
    });
  });

  it("removes horizontal letterboxing", () => {
    const pixels = frame(320, 180, { x: 0, y: 30, width: 320, height: 120 });
    expect(detectVideoContentBounds(pixels, 320, 180)).toEqual({
      x: 0,
      y: 31,
      width: 320,
      height: 118,
    });
  });

  it("preserves full frames, black frames, and asymmetric dark scenes", () => {
    const full = { x: 0, y: 0, width: 320, height: 180 };
    expect(detectVideoContentBounds(frame(320, 180, full), 320, 180)).toEqual(
      full,
    );
    expect(
      detectVideoContentBounds(new Uint8ClampedArray(320 * 180 * 4), 320, 180),
    ).toEqual(full);
    const scene = frame(320, 180, { x: 80, y: 0, width: 240, height: 180 });
    expect(detectVideoContentBounds(scene, 320, 180)).toEqual(full);
  });
});
