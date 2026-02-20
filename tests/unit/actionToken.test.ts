import { afterEach, describe, expect, it } from "vitest";
import { TOPIC_UI_ACTION_SCOPES } from "@/lib/actionToken";
import {
  hasActionTokenSecret,
  issueActionToken,
  verifyActionToken,
} from "@/lib/actionToken.server";

const ORIGINAL_ACTION_TOKEN_SECRET = process.env.ACTION_TOKEN_SECRET;
const ORIGINAL_REFLECTION_ACCESS_SECRET = process.env.REFLECTION_ACCESS_SECRET;
const ORIGINAL_SERVER_ACTIONS_KEY =
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;

const TOPIC_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TOPIC_ID = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  process.env.ACTION_TOKEN_SECRET = ORIGINAL_ACTION_TOKEN_SECRET;
  process.env.REFLECTION_ACCESS_SECRET = ORIGINAL_REFLECTION_ACCESS_SECRET;
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = ORIGINAL_SERVER_ACTIONS_KEY;
});

describe("action token helpers", () => {
  it("issues and verifies topic-scoped action tokens", () => {
    process.env.ACTION_TOKEN_SECRET = "test-secret";
    process.env.REFLECTION_ACCESS_SECRET = "";
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = "";

    expect(hasActionTokenSecret()).toBe(true);

    const token = issueActionToken({
      scopes: TOPIC_UI_ACTION_SCOPES,
      topicId: TOPIC_ID,
      requestId: "req-1",
    });

    expect(token).toBeTruthy();
    expect(
      verifyActionToken({
        token: token ?? "",
        requiredScope: "perspective:add",
        topicId: TOPIC_ID,
      }),
    ).toMatchObject({
      requestId: "req-1",
      topicId: TOPIC_ID,
    });
  });

  it("rejects tampered, wrong-scope, and wrong-topic tokens", () => {
    process.env.ACTION_TOKEN_SECRET = "test-secret";
    process.env.REFLECTION_ACCESS_SECRET = "";
    process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = "";

    const validToken = issueActionToken({
      scopes: ["perspective:align"],
      topicId: TOPIC_ID,
      requestId: "req-valid",
    });

    expect(
      verifyActionToken({
        token: `${validToken}x`,
        requiredScope: "perspective:align",
        topicId: TOPIC_ID,
      }),
    ).toBeNull();

    expect(
      verifyActionToken({
        token: validToken ?? "",
        requiredScope: "perspective:delete",
        topicId: TOPIC_ID,
      }),
    ).toBeNull();

    expect(
      verifyActionToken({
        token: validToken ?? "",
        requiredScope: "perspective:align",
        topicId: OTHER_TOPIC_ID,
      }),
    ).toBeNull();
  });
});
