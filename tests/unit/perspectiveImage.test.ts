import { describe, expect, it } from "vitest";
import {
  extractMarkdownBackgroundImageSrc,
  resolvePerspectiveBackgroundImageSrc,
} from "@/lib/perspectiveImage";

describe("perspective image helpers", () => {
  it("uses explicit perspective image before markdown background images", () => {
    expect(
      resolvePerspectiveBackgroundImageSrc({
        image_src: " explicit.webp ",
        perspective: "![bg](markdown.webp)",
      }),
    ).toBe("explicit.webp");
  });

  it("extracts bg and background markdown images only", () => {
    expect(extractMarkdownBackgroundImageSrc("![alt](inline.webp)")).toBe("");
    expect(extractMarkdownBackgroundImageSrc("![bg](bg.webp)")).toBe("bg.webp");
    expect(extractMarkdownBackgroundImageSrc("![background](hero.png)")).toBe(
      "hero.png",
    );
  });
});
