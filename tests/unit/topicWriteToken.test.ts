import { describe, expect, it } from "vitest";
import {
  resolveTopicWriteToken,
  TOPIC_LOCKED_RESPONSE,
} from "@/lib/topicWriteToken";

describe("topicWriteToken", () => {
  it("prefers explicit token from payload when present", () => {
    const request = new Request("http://localhost:3000/api/p", {
      headers: {
        cookie: "t_art=cookie-token",
      },
    });

    expect(
      resolveTopicWriteToken({
        request,
        topicName: "art",
        topicId: "f0b8be17-5be9-44e4-8ac0-d11fa0123456",
        bodyToken: "inline-token",
      }),
    ).toBe("inline-token");
  });

  it("falls back to topic-id cookie when body token is missing", () => {
    const topicId = "f0b8be17-5be9-44e4-8ac0-d11fa0123456";
    const request = new Request("http://localhost:3000/api/p", {
      headers: {
        cookie: `x=y; t_${topicId}=cookie-by-id; a=b`,
      },
    });

    expect(
      resolveTopicWriteToken({
        request,
        topicName: "art-renamed",
        topicId,
      }),
    ).toBe("cookie-by-id");
  });

  it("exports the locked error payload for write endpoints", () => {
    expect(TOPIC_LOCKED_RESPONSE).toEqual({
      code: "TOPIC_LOCKED",
      error: "Topic is locked",
    });
  });
});
