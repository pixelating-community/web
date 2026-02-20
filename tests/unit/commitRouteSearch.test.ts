import { describe, expect, it } from "vitest";
import {
  appendSavedSearchParam,
  commitSearchSchema,
  normalizeCommitModeSearchParam,
  parseCommitReturnPath,
  sanitizeCommitReturnPath,
} from "@/lib/commitRouteSearch";

describe("commitRouteSearch", () => {
  it("normalizes commit mode values including quoted values", () => {
    expect(normalizeCommitModeSearchParam(1)).toBe("1");
    expect(normalizeCommitModeSearchParam("1")).toBe("1");
    expect(normalizeCommitModeSearchParam("s")).toBe("s");
    expect(normalizeCommitModeSearchParam('"1"')).toBe("1");
    expect(normalizeCommitModeSearchParam('"s"')).toBe("s");
    expect(normalizeCommitModeSearchParam("  \"1\"  ")).toBe("1");
  });

  it("validates commit search schema for normalized mode values", () => {
    expect(commitSearchSchema.parse({ m: "1" }).m).toBe("1");
    expect(commitSearchSchema.parse({ m: '"1"' }).m).toBe("1");
    expect(commitSearchSchema.parse({ m: 1 }).m).toBe("1");
    expect(commitSearchSchema.parse({ m: "s" }).m).toBe("s");
  });

  it("rejects invalid commit mode values", () => {
    expect(() => commitSearchSchema.parse({ m: "x" })).toThrow(/invalid/i);
    expect(() => commitSearchSchema.parse({ m: '"x"' })).toThrow(/invalid/i);
  });

  it("sanitizes return paths to topic or perspective routes", () => {
    const fallback = "/t/art/w?p=abc&m=1";
    expect(sanitizeCommitReturnPath("/t/art/w?p=abc", fallback)).toBe(
      "/t/art/w?p=abc",
    );
    expect(sanitizeCommitReturnPath("/p/123", fallback)).toBe("/p/123");
    expect(sanitizeCommitReturnPath("https://evil.example", fallback)).toBe(
      fallback,
    );
    expect(sanitizeCommitReturnPath("//evil.example", fallback)).toBe(fallback);
    expect(sanitizeCommitReturnPath("/api/p", fallback)).toBe(fallback);
    expect(sanitizeCommitReturnPath("", fallback)).toBe(fallback);
  });

  it("decodes encoded return paths safely", () => {
    const fallback = "/t/art/w?p=abc&m=1";
    expect(
      parseCommitReturnPath({
        fallbackPath: fallback,
        rawReturn: "%2Ft%2Fart%2Fw%3Fp%3Dabc",
      }),
    ).toBe("/t/art/w?p=abc");
    expect(
      parseCommitReturnPath({
        fallbackPath: fallback,
        rawReturn: "%E0%A4%A",
      }),
    ).toBe(fallback);
  });

  it("appends saved=1 while preserving existing params", () => {
    expect(appendSavedSearchParam("/t/art/w?p=abc")).toBe(
      "/t/art/w?p=abc&saved=1",
    );
    expect(appendSavedSearchParam("/t/art/w?p=abc#x")).toBe(
      "/t/art/w?p=abc&saved=1#x",
    );
  });
});
