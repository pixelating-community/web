import { afterEach, describe, expect, it } from "vitest";
import {
  createReflectionAccessToken,
  createReflectionWriteToken,
  formatPerspectiveShareCode,
  generatePerspectiveShareCode,
  hashPerspectiveShareCode,
  normalizePerspectiveShareCode,
  verifyReflectionAccessToken,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";

const ORIGINAL_REFLECTION_ACCESS_SECRET = process.env.REFLECTION_ACCESS_SECRET;
const PERSPECTIVE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PERSPECTIVE_ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  process.env.REFLECTION_ACCESS_SECRET = ORIGINAL_REFLECTION_ACCESS_SECRET;
});

describe("reflectionAccess", () => {
  it("normalizes, formats, and hashes perspective share codes consistently", () => {
    process.env.REFLECTION_ACCESS_SECRET = "reflection-secret";

    expect(normalizePerspectiveShareCode("ab-cd ef23..jk9m")).toBe("ABCDEF23JK9M");
    expect(formatPerspectiveShareCode("ab-cd ef23..jk9m")).toBe("ABCD-EF23-JK9M");

    const hashA = hashPerspectiveShareCode("abcd-ef23-jk9m");
    const hashB = hashPerspectiveShareCode("ABCD EF23 JK9M");

    expect(hashA).toBeTruthy();
    expect(hashA).toBe(hashB);
  });

  it("generates codes in the expected reveal format", () => {
    const code = generatePerspectiveShareCode();

    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTVWXYZ23456789]{4}$/);
  });

  it("issues and verifies scoped reflection access and write tokens", () => {
    process.env.REFLECTION_ACCESS_SECRET = "reflection-secret";

    const accessToken = createReflectionAccessToken(PERSPECTIVE_ID);
    const writeToken = createReflectionWriteToken(PERSPECTIVE_ID);

    expect(verifyReflectionAccessToken(accessToken, PERSPECTIVE_ID)).toBe(true);
    expect(verifyReflectionWriteToken(writeToken, PERSPECTIVE_ID)).toBe(true);
    expect(verifyReflectionAccessToken(accessToken, OTHER_PERSPECTIVE_ID)).toBe(false);
    expect(verifyReflectionWriteToken(writeToken, OTHER_PERSPECTIVE_ID)).toBe(false);
  });
});
