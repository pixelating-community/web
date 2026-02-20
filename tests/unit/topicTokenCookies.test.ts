import { describe, expect, it } from "vitest";
import {
  getTopicTokenCookieNames,
  resolveTopicTokenFromRequest,
} from "@/lib/topicTokenCookies";

describe("topicTokenCookies", () => {
  it("returns canonical topic-name cookie first, then topic-id cookie", () => {
    expect(
      getTopicTokenCookieNames({
        topicName: "art",
        topicId: "f0b8be17-5be9-44e4-8ac0-d11fa0123456",
      }),
    ).toEqual(["t_art", "t_f0b8be17-5be9-44e4-8ac0-d11fa0123456"]);
  });

  it("deduplicates cookie names when topic name equals topic id", () => {
    expect(
      getTopicTokenCookieNames({
        topicName: "abc",
        topicId: "abc",
      }),
    ).toEqual(["t_abc"]);
  });

  it("resolves token by canonical name first and falls back to id cookie", () => {
    const requestWithIdOnly = new Request("http://localhost:3000/t/art", {
      headers: {
        cookie: "x=y; t_f0b8be17-5be9-44e4-8ac0-d11fa0123456=secret-by-id; a=b",
      },
    });
    expect(
      resolveTopicTokenFromRequest({
        request: requestWithIdOnly,
        topicName: "art",
        topicId: "f0b8be17-5be9-44e4-8ac0-d11fa0123456",
      }),
    ).toBe("secret-by-id");

    const requestWithBoth = new Request("http://localhost:3000/t/art", {
      headers: {
        cookie:
          "t_f0b8be17-5be9-44e4-8ac0-d11fa0123456=secret-by-id; t_art=secret-by-name",
      },
    });
    expect(
      resolveTopicTokenFromRequest({
        request: requestWithBoth,
        topicName: "art",
        topicId: "f0b8be17-5be9-44e4-8ac0-d11fa0123456",
      }),
    ).toBe("secret-by-name");
  });
});
