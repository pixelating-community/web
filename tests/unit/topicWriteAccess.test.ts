import { describe, expect, it } from "vitest";
import {
  resolveStoredTopicToken,
  shouldRequireTopicUnlock,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";

describe("topic write access policy", () => {
  it("requires token when topic is locked", () => {
    expect(
      topicRequiresWriteToken({
        locked: true,
        storedToken: undefined,
      }),
    ).toBe(true);
  });

  it("requires token when unlocked topic has a configured token", () => {
    expect(
      topicRequiresWriteToken({
        locked: false,
        storedToken: "$2b$12$test",
      }),
    ).toBe(true);
  });

  it("does not require token when unlocked topic has no token", () => {
    expect(
      topicRequiresWriteToken({
        locked: false,
        storedToken: undefined,
      }),
    ).toBe(false);
  });

  it("normalizes and resolves non-empty stored tokens", () => {
    expect(resolveStoredTopicToken("  abc  ")).toBe("abc");
    expect(resolveStoredTopicToken("   ")).toBeUndefined();
    expect(resolveStoredTopicToken(null)).toBeUndefined();
  });

  it("does not require unlock for public read routes when write access is restricted", () => {
    expect(
      shouldRequireTopicUnlock({
        locked: false,
        canAccess: true,
        canWrite: false,
        wantsWriteAccess: false,
      }),
    ).toBe(false);
  });

  it("requires unlock for public write routes when write access is restricted", () => {
    expect(
      shouldRequireTopicUnlock({
        locked: false,
        canAccess: true,
        canWrite: false,
        wantsWriteAccess: true,
      }),
    ).toBe(true);
  });

  it("requires unlock for locked topics without read access", () => {
    expect(
      shouldRequireTopicUnlock({
        locked: true,
        canAccess: false,
        canWrite: false,
        wantsWriteAccess: false,
      }),
    ).toBe(true);
  });
});
