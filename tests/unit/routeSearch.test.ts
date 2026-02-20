import { describe, expect, it } from "vitest";
import {
  parseTopicRouteSearch,
  parseTopicUnlockSearch,
} from "@/lib/routeSearch";

describe("route search parsing", () => {
  it("normalizes topic route search strings", () => {
    expect(
      parseTopicRouteSearch({
        p: "  perspective-view  ",
        r: "  perspective-edit  ",
        w: "",
      }),
    ).toEqual({
      p: "perspective-view",
      r: "perspective-edit",
      w: undefined,
    });
  });

  it("keeps only meaningful unlock search params", () => {
    expect(parseTopicUnlockSearch({ next: "   /t/topic?w=n  " })).toEqual({
      next: "/t/topic?w=n",
    });
    expect(parseTopicUnlockSearch({ next: "   " })).toEqual({
      next: undefined,
    });
  });
});
