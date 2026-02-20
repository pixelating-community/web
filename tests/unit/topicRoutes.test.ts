import { describe, expect, it } from "vitest";
import {
  buildTopicPerspectivePath,
  buildTopicPath,
  buildTopicUnlockHref,
  sanitizeTopicNextPath,
} from "@/lib/topicRoutes";

describe("topicRoutes", () => {
  it("builds canonical topic and action paths", () => {
    expect(buildTopicPath("art")).toBe("/t/art");
    expect(buildTopicPath("art", "w")).toBe("/t/art/w");
    expect(buildTopicPath("art tools", "sw mode")).toBe(
      "/t/art%20tools/sw%20mode",
    );
  });

  it("builds unlock href with encoded next path", () => {
    expect(
      buildTopicUnlockHref({
        topicName: "art",
        nextPath: "/t/art/w",
      }),
    ).toBe("/t/art/ul?next=%2Ft%2Fart%2Fw");
  });

  it("builds perspective edit links", () => {
    expect(
      buildTopicPerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/t/art%20tools/w?p=1234-abcd");
  });

  it("sanitizes unsafe unlock next paths", () => {
    const fallbackPath = "/t/art/w";
    expect(
      sanitizeTopicNextPath({
        nextPath: "/t/art/sw",
        fallbackPath,
      }),
    ).toBe("/t/art/w");
    expect(
      sanitizeTopicNextPath({
        nextPath: "https://evil.example/steal",
        fallbackPath,
      }),
    ).toBe(fallbackPath);
    expect(
      sanitizeTopicNextPath({
        nextPath: "//evil.example/steal",
        fallbackPath,
      }),
    ).toBe(fallbackPath);
    expect(
      sanitizeTopicNextPath({
        nextPath: "/api/p",
        fallbackPath,
      }),
    ).toBe(fallbackPath);
    expect(
      sanitizeTopicNextPath({
        nextPath: "/t/art/ul",
        fallbackPath,
      }),
    ).toBe(fallbackPath);
  });
});
