import { describe, expect, it } from "vitest";
import {
  buildPerspectiveJoinPath,
  buildTopicNewPerspectivePath,
  buildTopicKaraokeEditorPath,
  buildTopicKaraokePath,
  buildTopicPerspectivePath,
  buildTopicPath,
  buildTopicUnlockHref,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
  NEW_PERSPECTIVE_HASH,
  NEW_PERSPECTIVE_QUERY_VALUE,
  sanitizeTopicNextPath,
} from "@/lib/topicRoutes";

describe("topicRoutes", () => {
  it("builds perspective collaboration invite paths", () => {
    expect(buildPerspectiveJoinPath(" 1234-abcd ")).toBe("/p/1234-abcd/join");
  });

  it("builds canonical topic and action paths", () => {
    expect(buildTopicPath("art")).toBe("/c/art");
    expect(buildTopicPath("  ")).toBe("/c");
    expect(buildTopicPath("art", "w")).toBe("/c/art/w");
    expect(buildTopicPath("art tools", "listen mode")).toBe(
      "/c/art%20tools/listen%20mode",
    );
  });

  it("builds unlock href with encoded next path", () => {
    expect(
      buildTopicUnlockHref({
        topicName: "art",
        nextPath: "/c/art",
      }),
    ).toBe("/c/art/ul?next=%2Fc%2Fart");
  });

  it("builds perspective editor links as path segments", () => {
    expect(
      buildTopicPerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/c/art%20tools/r/1234-abcd");
  });

  it("builds perspective write links as path segments with hash", () => {
    expect(
      buildTopicWritePerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/c/art%20tools/w/1234-abcd");
  });

  it("builds new perspective links with the create sentinel", () => {
    expect(NEW_PERSPECTIVE_HASH).toBe("n");
    expect(NEW_PERSPECTIVE_QUERY_VALUE).toBe("n");
    expect(buildTopicNewPerspectivePath("art tools")).toBe(
      "/c/art%20tools/w/n",
    );
    expect(buildTopicNewPerspectivePath("art tools")).toBe(
      "/c/art%20tools/w/n",
    );
  });

  it("builds perspective viewer links as path segments", () => {
    expect(
      buildTopicViewerPerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/c/art%20tools/p/1234-abcd");
  });

  it("builds karaoke and karaoke editor links as path segments", () => {
    expect(
      buildTopicKaraokePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/c/art%20tools/k/1234-abcd");
    expect(
      buildTopicKaraokeEditorPath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/c/art%20tools/ke/1234-abcd");
  });

  it("sanitizes unsafe unlock next paths", () => {
    const fallbackPath = "/c/art";
    // Valid paths with mode segments pass through
    expect(
      sanitizeTopicNextPath({
        nextPath: "/c/art/w/1234",
        fallbackPath,
      }),
    ).toBe("/c/art/w/1234");
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
        nextPath: "/c/art/ul",
        fallbackPath,
      }),
    ).toBe(fallbackPath);
  });
});
