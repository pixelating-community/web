import { describe, expect, it } from "vitest";
import {
  getTrackPlaybackEnd,
  resolvePerspectivePlaybackPlan,
  resolvePlaybackEndedPlan,
  shouldStartPlaybackFromBeginning,
} from "@/components/sw/playbackController";
import type { Perspective } from "@/types/perspectives";

describe("sw playback controller helpers", () => {
  it("keeps inline playback restarting from the start when a track is already at its end", () => {
    expect(
      shouldStartPlaybackFromBeginning({
        currentTime: 4.97,
        duration: 5,
        track: { start: 0, end: 5 },
      }),
    ).toBe(true);
    expect(
      getTrackPlaybackEnd({
        track: { start: 1.5, end: 4.25 },
        duration: Number.NaN,
      }),
    ).toBe(4.25);
  });

  it("keeps studio playback redirecting to the dedicated viewer on mobile when requested", () => {
    expect(
      resolvePerspectivePlaybackPlan({
        audioCurrentTime: 0,
        audioDuration: 5,
        audioEnded: false,
        audioPaused: true,
        currentSrc: "/api/obj?key=current",
        isMobileViewport: true,
        isSamePerspective: true,
        isStudioSurface: true,
        nextSrc: "/api/obj?key=current",
        readyState: 4,
        redirectMobileEditorPlaybackToViewer: true,
        track: { start: 0, end: 5 },
        viewerHref: "/p/p1",
      }),
    ).toEqual({
      action: "navigate",
      href: "/p/p1",
    });
  });

  it("keeps editor playback swapping tracks and starting the next perspective from the beginning", () => {
    expect(
      resolvePerspectivePlaybackPlan({
        audioCurrentTime: 1.2,
        audioDuration: 8,
        audioEnded: false,
        audioPaused: true,
        currentSrc: "/api/obj?key=one",
        isMobileViewport: false,
        isSamePerspective: false,
        isStudioSurface: true,
        nextSrc: "/api/obj?key=two",
        readyState: 4,
        redirectMobileEditorPlaybackToViewer: false,
        track: { start: 2, end: 6 },
        viewerHref: "/p/p2",
      }),
    ).toEqual({
      action: "play",
      fromStart: true,
      shouldLoad: true,
      shouldPauseFirst: true,
      shouldReplaceSrc: true,
    });
  });

  it("keeps viewer inline playback pausing when the active perspective is already playing", () => {
    expect(
      resolvePerspectivePlaybackPlan({
        audioCurrentTime: 1.2,
        audioDuration: 8,
        audioEnded: false,
        audioPaused: false,
        currentSrc: "/api/obj?key=one",
        isMobileViewport: false,
        isSamePerspective: true,
        isStudioSurface: false,
        nextSrc: "/api/obj?key=one",
        readyState: 4,
        redirectMobileEditorPlaybackToViewer: false,
        track: { start: 0, end: 8 },
        viewerHref: "/p/p1",
      }),
    ).toEqual({
      action: "pause",
    });
  });

  it("keeps sequence playback advancing only when a next playable perspective exists", () => {
    const nextPerspective = {
      id: "p2",
      perspective: "next",
      topic_id: "t",
    } as Perspective;

    expect(
      resolvePlaybackEndedPlan({
        activePerspectiveId: "p1",
        nextPerspective,
        nextSrc: "/api/obj?key=next",
        playbackMode: "sequence",
        track: { start: 0, end: 4 },
      }),
    ).toEqual({
      action: "advance",
      perspective: nextPerspective,
      src: "/api/obj?key=next",
      track: { start: 0, end: 4 },
    });
    expect(
      resolvePlaybackEndedPlan({
        activePerspectiveId: "p1",
        nextPerspective: null,
        nextSrc: "",
        playbackMode: "sequence",
        track: { start: 0, end: 4 },
      }),
    ).toEqual({
      action: "complete",
    });
  });
});
