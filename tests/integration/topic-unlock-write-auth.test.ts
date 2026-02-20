import { describe, expect, it } from "vitest";
import { buildTopicUnlockHref } from "@/lib/topicRoutes";
import { getTopicTokenCookieNames } from "@/lib/topicTokenCookies";
import { resolveTopicWriteToken } from "@/lib/topicWriteToken";

describe("topic unlock/write auth flow", () => {
  it("builds ul href and resolves write token from topic-id cookie fallback", () => {
    const topicId = "f0b8be17-5be9-44e4-8ac0-d11fa0123456";
    const originalTopicName = "art";
    const renamedTopicName = "art-renamed";
    const token = "tan4Mg8P";

    const cookieNames = getTopicTokenCookieNames({
      topicId,
      topicName: originalTopicName,
    });
    const nextPath = `/t/${renamedTopicName}/w`;
    const unlockHref = buildTopicUnlockHref({
      topicName: renamedTopicName,
      nextPath,
    });

    expect(unlockHref).toBe(
      `/t/${renamedTopicName}/ul?next=${encodeURIComponent(nextPath)}`,
    );

    const request = new Request(`http://localhost:3000${nextPath}`, {
      headers: {
        cookie: `${cookieNames[1]}=${token}; x=y`,
      },
    });

    expect(
      resolveTopicWriteToken({
        request,
        topicName: renamedTopicName,
        topicId,
      }),
    ).toBe(token);
  });
});
