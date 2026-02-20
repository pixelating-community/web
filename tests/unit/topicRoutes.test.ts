import { describe, expect, it } from "vitest";
import {
  buildTopicNewPerspectiveHref,
  buildTopicNewPerspectivePath,
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
        nextPath: "/t/art",
      }),
    ).toBe("/t/art/ul?next=%2Ft%2Fart");
  });

  it("builds perspective editor links", () => {
    expect(
      buildTopicPerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/t/art%20tools?r=1234-abcd");
  });

  it("builds perspective write links", () => {
    expect(
      buildTopicWritePerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/t/art%20tools?w=1234-abcd");
  });

  it("builds new perspective links with the create sentinel", () => {
    expect(NEW_PERSPECTIVE_HASH).toBe("n");
    expect(NEW_PERSPECTIVE_QUERY_VALUE).toBe("n");
    expect(buildTopicNewPerspectivePath("art tools")).toBe(
      "/t/art%20tools?w=n",
    );
    expect(buildTopicNewPerspectiveHref("art tools")).toBe(
      "/t/art%20tools?w=n#n",
    );
  });

  it("builds perspective viewer links", () => {
    expect(
      buildTopicViewerPerspectivePath({
        topicName: "art tools",
        perspectiveId: "1234-abcd",
      }),
    ).toBe("/t/art%20tools?p=1234-abcd");
  });

  it("sanitizes unsafe unlock next paths", () => {
    const fallbackPath = "/t/art";
    expect(
      sanitizeTopicNextPath({
        nextPath: "/t/art/sw",
        fallbackPath,
      }),
    ).toBe("/t/art");
    expect(
      sanitizeTopicNextPath({
        nextPath: "/t/art/w?p=123",
        fallbackPath,
      }),
    ).toBe("/t/art?p=123");
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
