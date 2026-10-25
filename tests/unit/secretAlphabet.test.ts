import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SM } from "@/components/SM";
import {
  getSecretLetter,
  getSMPngDimensions,
  layoutSM,
  SECRET_ALPHABET,
  SM_LIMIT,
} from "@/lib/secretAlphabet";

describe("secret alphabet", () => {
  it("keeps long phone PNG exports within the image memory budget", () => {
    for (const message of ["A".repeat(SM_LIMIT), "A\n".repeat(SM_LIMIT / 2)]) {
      const layout = layoutSM(message, 4);
      const dimensions = getSMPngDimensions(layout);
      expect(dimensions.width).toBeGreaterThan(0);
      expect(dimensions.height).toBeGreaterThan(0);
      expect(dimensions.width).toBeLessThanOrEqual(8192);
      expect(dimensions.height).toBeLessThanOrEqual(8192);
      expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(
        8_000_000,
      );
      expect(
        Math.abs(
          dimensions.width - (layout.width * dimensions.height) / layout.height,
        ),
      ).toBeLessThan(1);
    }
  });

  it("exports short messages at double resolution", () => {
    const layout = layoutSM("HI");
    expect(getSMPngDimensions(layout)).toEqual({
      width: layout.width * 2,
      height: layout.height * 2,
    });
  });

  it("encodes the full alphabet in either case, including the temporary Z", () => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    expect(Object.keys(SECRET_ALPHABET).join("")).toBe(alphabet);
    expect(
      layoutSM(alphabet.toLowerCase(), 32)
        .symbols.map((symbol) => symbol.letter)
        .join(""),
    ).toBe(alphabet);
    expect(getSecretLetter("ß")).toBeNull();
    expect(getSecretLetter("é")).toBeNull();
  });

  it("keeps word boundaries and explicit line breaks when wrapping", () => {
    const layout = layoutSM("HI ALL\r\nBYE", 4);
    expect(layout.symbols.map(({ character }) => character).join("")).toBe(
      "HIALLBYE",
    );
    expect(layout.symbols[0]).toMatchObject({ x: 32, y: 32 });
    expect(layout.symbols[2]).toMatchObject({ x: 32, y: 112 });
    expect(layout.symbols[5]).toMatchObject({ x: 32, y: 192 });
  });

  it("splits long words without clipping or losing symbols", () => {
    const layout = layoutSM("ABCDEFGHI", 3);
    expect(layout.symbols).toHaveLength(9);
    for (const symbol of layout.symbols) {
      expect(symbol.x + 48).toBeLessThanOrEqual(layout.width - 32);
      expect(symbol.y + 80).toBeLessThanOrEqual(layout.height - 32);
    }
  });

  it("preserves indentation, tabs and empty lines", () => {
    const layout = layoutSM("  A\n\n\tB");
    expect(layout.symbols[0]).toMatchObject({ x: 128, y: 32 });
    expect(layout.symbols[1]).toMatchObject({ x: 224, y: 192 });
    expect(layoutSM("").symbols).toEqual([]);
  });

  it("reports unencoded letters and controls, while allowing numbers and punctuation", () => {
    expect(layoutSM("Café é 中文\u0000! 123").unsupported).toEqual([
      "é",
      "中",
      "文",
      "\u0000",
    ]);
    expect(layoutSM("Hi, 123! <>&").unsupported).toEqual([]);
  });

  it("exports paths without embedding the original English letters", () => {
    const markup = renderToStaticMarkup(
      createElement(SM, {
        layout: layoutSM("TOP SECRET"),
      }),
    );
    expect(markup.match(/<path /g)).toHaveLength(9);
    expect(markup).not.toContain("TOP");
    expect(markup).not.toContain("SECRET");
    expect(markup).not.toContain("<text");
  });

  it("escapes punctuation and replaces unsupported letters in the artwork", () => {
    const markup = renderToStaticMarkup(
      createElement(SM, { layout: layoutSM("<>&é") }),
    );
    expect(markup).toContain("&lt;");
    expect(markup).toContain("&gt;");
    expect(markup).toContain("&amp;");
    expect(markup).toContain(">?</text>");
    expect(markup).not.toContain("é");
  });
});
