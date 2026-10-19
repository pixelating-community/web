import { describe, expect, it } from "vitest";
import * as chapters from "@/lib/chapterRoutes";
import * as topics from "@/lib/topicRoutes";
import { sanitizeCommitReturnPath } from "@/lib/commitRouteSearch";

describe("separate topic and chapter navigation", () => {
  it.each([
    [topics, "/t"],
    [chapters, "/c"],
  ] as const)("retains the route family for %s", (routes, prefix) => {
    const input = { topicName: "start sw", perspectiveId: "perspective-id" };
    expect(routes.buildTopicPath(input.topicName)).toBe(`${prefix}/start%20sw`);
    expect(routes.buildTopicKaraokePath(input)).toBe(
      `${prefix}/start%20sw/k/perspective-id`,
    );
    expect(routes.buildTopicNewPerspectivePath(input.topicName)).toBe(
      `${prefix}/start%20sw/w/n`,
    );
    expect(routes.buildTopicWritePerspectivePath(input)).toBe(
      `${prefix}/start%20sw/w/perspective-id`,
    );
    expect(
      routes.buildTopicUnlockHref({
        topicName: "startsw",
        nextPath: `${prefix}/startsw`,
      }),
    ).toBe(
      `${prefix}/startsw/ul?next=${encodeURIComponent(`${prefix}/startsw`)}`,
    );
    const nextPath = `${prefix}/startsw/w/perspective-id`;
    expect(
      routes.sanitizeTopicNextPath({
        nextPath,
        fallbackPath: `${prefix}/startsw`,
      }),
    ).toBe(nextPath);
    expect(sanitizeCommitReturnPath(nextPath, "/p/fallback")).toBe(nextPath);
  });

  it("keeps unlock destinations in their own content type", () => {
    expect(
      topics.sanitizeTopicNextPath({
        nextPath: "/c/startsw",
        fallbackPath: "/t/startsw",
      }),
    ).toBe("/t/startsw");
    expect(
      chapters.sanitizeTopicNextPath({
        nextPath: "/t/startsw",
        fallbackPath: "/c/startsw",
      }),
    ).toBe("/c/startsw");
  });
});
