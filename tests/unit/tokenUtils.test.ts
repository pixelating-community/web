import { describe, expect, it } from "vitest";
import { resolveTokenInputValue } from "@/components/token/tokenUtils";

describe("resolveTokenInputValue", () => {
  it("prefers the live input value over stale state value", () => {
    expect(resolveTokenInputValue("  tan4Mg8P  ", "")).toBe("tan4Mg8P");
  });

  it("falls back to state when input is empty", () => {
    expect(resolveTokenInputValue("   ", " fallback-token ")).toBe(
      "fallback-token",
    );
  });

  it("returns empty string when both sources are empty", () => {
    expect(resolveTokenInputValue("", "")).toBe("");
  });
});
