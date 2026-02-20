import type { Perspective } from "@/types/perspectives";
import type { PlaybackTrackBounds, SWPlaybackMode } from "./types";

export const getTrackPlaybackEnd = ({
  track,
  duration,
}: {
  track: PlaybackTrackBounds | null;
  duration: number;
}) =>
  typeof track?.end === "number" && Number.isFinite(track.end)
    ? track.end
    : Number.isFinite(duration)
      ? duration
      : undefined;

export const shouldStartPlaybackFromBeginning = ({
  fromStart = false,
  currentTime,
  duration,
  track,
}: {
  fromStart?: boolean;
  currentTime: number;
  duration: number;
  track: PlaybackTrackBounds | null;
}) => {
  if (fromStart) return true;
  const trackEnd = getTrackPlaybackEnd({ track, duration });
  if (trackEnd === undefined) return false;
  return currentTime >= trackEnd - 0.05;
};

export type PerspectivePlaybackPlan =
  | {
      action: "navigate";
      href: string;
    }
  | {
      action: "pause";
    }
  | {
      action: "play";
      fromStart: boolean;
      shouldLoad: boolean;
      shouldPauseFirst: boolean;
      shouldReplaceSrc: boolean;
    };

export const resolvePerspectivePlaybackPlan = ({
  audioCurrentTime,
  audioDuration,
  audioEnded,
  audioPaused,
  currentSrc,
  isMobileViewport,
  isSamePerspective,
  isStudioSurface,
  nextSrc,
  readyState,
  redirectMobileEditorPlaybackToViewer,
  track,
  viewerHref,
}: {
  audioCurrentTime: number;
  audioDuration: number;
  audioEnded: boolean;
  audioPaused: boolean;
  currentSrc: string;
  isMobileViewport: boolean;
  isSamePerspective: boolean;
  isStudioSurface: boolean;
  nextSrc: string;
  readyState: number;
  redirectMobileEditorPlaybackToViewer: boolean;
  track: PlaybackTrackBounds | null;
  viewerHref: string;
}): PerspectivePlaybackPlan => {
  if (
    isStudioSurface &&
    redirectMobileEditorPlaybackToViewer &&
    isMobileViewport
  ) {
    return {
      action: "navigate",
      href: viewerHref,
    };
  }

  if (!isSamePerspective) {
    return {
      action: "play",
      fromStart: true,
      shouldLoad: currentSrc !== nextSrc,
      shouldPauseFirst: true,
      shouldReplaceSrc: currentSrc !== nextSrc,
    };
  }

  if (!audioPaused && currentSrc === nextSrc) {
    return {
      action: "pause",
    };
  }

  return {
    action: "play",
    fromStart: shouldStartPlaybackFromBeginning({
      currentTime: audioCurrentTime,
      duration: audioDuration,
      fromStart: audioEnded,
      track,
    }),
    shouldLoad: currentSrc !== nextSrc || readyState === 0,
    shouldPauseFirst: currentSrc !== nextSrc,
    shouldReplaceSrc: currentSrc !== nextSrc,
  };
};

export type PlaybackEndedPlan =
  | {
      action: "complete";
    }
  | {
      action: "advance";
      perspective: Perspective;
      src: string;
      track: PlaybackTrackBounds;
    };

export const resolvePlaybackEndedPlan = ({
  activePerspectiveId,
  nextPerspective,
  nextSrc,
  playbackMode,
  track,
}: {
  activePerspectiveId: string;
  nextPerspective: Perspective | null;
  nextSrc: string;
  playbackMode: SWPlaybackMode;
  track: PlaybackTrackBounds;
}): PlaybackEndedPlan => {
  if (playbackMode !== "sequence") {
    return {
      action: "complete",
    };
  }
  if (!nextPerspective || !nextSrc) {
    return {
      action: "complete",
    };
  }
  if (nextPerspective.id === activePerspectiveId) {
    return {
      action: "complete",
    };
  }
  return {
    action: "advance",
    perspective: nextPerspective,
    src: nextSrc,
    track,
  };
};
