import { describe, expect, it } from "vitest";
import {
  parseTopicRouteSearch,
  parseTopicUnlockSearch,
  setTimestampSearchParams,
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
      e: undefined,
      i: undefined,
      parent: undefined,
      p: "perspective-view",
      r: "perspective-edit",
      s: undefined,
      timingEditor: undefined,
      v: undefined,
      w: undefined,
    });
  });

  it("omits tiny timestamp ranges that would create short loops", () => {
    expect(
      parseTopicRouteSearch({
        p: "perspective-view",
        s: "246.755671",
        e: "246.911676",
      }),
    ).toMatchObject({
      e: undefined,
      p: "perspective-view",
      s: 246.755671,
    });

    expect(
      parseTopicRouteSearch({
        s: "10",
        e: "10.21",
      }).e,
    ).toBe(10.21);

    const params = new URLSearchParams();
    setTimestampSearchParams({
      end: 246.911676,
      params,
      start: 246.755671,
    });
    expect(params.toString()).toBe("s=246.755671");
  });

  it("accepts an explicit timing editor search mode", () => {
    expect(parseTopicRouteSearch({ timingEditor: "1" }).timingEditor).toBe("1");
    expect(parseTopicRouteSearch({ timingEditor: 1 }).timingEditor).toBe("1");
    expect(parseTopicRouteSearch({ timingEditor: '"1"' }).timingEditor).toBe(
      "1",
    );
    expect(parseTopicRouteSearch({ timingEditor: " full " }).timingEditor).toBe(
      "full",
    );
    expect(
      parseTopicRouteSearch({ timingEditor: "  " }).timingEditor,
    ).toBeUndefined();
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
