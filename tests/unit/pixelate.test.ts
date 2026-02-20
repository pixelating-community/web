import { describe, expect, it } from "vitest";
import { resolveImageCanvasDimensions } from "@/components/Pixelate";

describe("pixelate dimensions", () => {
  it("keeps the rendered canvas at the original image dimensions", () => {
    expect(
      resolveImageCanvasDimensions({
        imageWidth: 1200,
        imageHeight: 800,
      }),
    ).toEqual({ width: 1200, height: 800 });

    expect(
      resolveImageCanvasDimensions({
        imageWidth: 800,
        imageHeight: 1200,
      }),
    ).toEqual({ width: 800, height: 1200 });
  });
});
