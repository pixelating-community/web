"use client";

import { useRouter } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  hasPlayableAudioSource,
  STUDIO_PLAYBACK_RATES,
} from "@/components/sw/runtime";
import { setAudioSessionType } from "@/lib/audioSession";
import type { Perspective } from "@/types/perspectives";
import {
  resolvePerspectivePlaybackPlan,
  resolvePlaybackEndedPlan,
  shouldStartPlaybackFromBeginning,
} from "@/components/sw/playbackController";
import type {
  AudioPlaybackError,
  PlaybackTrackBounds,
  SWPlaybackMode,
  ViewerPlayBehavior,
} from "@/components/sw/types";

const PLAYBACK_SYNC_MAX_FPS = 24;
const PLAYBACK_SYNC_INTERVAL_MS = 1000 / PLAYBACK_SYNC_MAX_FPS;
const PLAYBACK_SYNC_MIN_DELTA_SECONDS = 0.005;

const isPlaybackAbort = (payload: {
  code?: number | null;
  message?: string | null;
  reason?: unknown;
}) => {
  if (payload.code === 1) return true;
  const reason = payload.reason;
  if (
    reason instanceof DOMException &&
    (reason.name === "AbortError" || reason.name === "NotAllowedError")
  ) {
    return true;
  }
  if (
    reason &&
    typeof reason === "object" &&
    "name" in reason &&
    ((reason as { name?: unknown }).name === "AbortError" ||
      (reason as { name?: unknown }).name === "NotAllowedError")
  ) {
    return true;
  }
  const message =
    payload.message ??
    (reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "");
  return /operation was aborted|aborted|not allowed by the user agent or the platform|notallowederror/i.test(
    message,
  );
};

type UseSwPlaybackControllerArgs = {
  audioFor: (perspective: Perspective) => string;
  autoStartOnLoad: boolean;
  currentTrack: Perspective | null;
  getNextPlayablePerspective: (activePerspectiveId: string) => Perspective | null;
  hasSelectedAudio: boolean;
  isStudioSurface: boolean;
  isViewer: boolean;
  onViewerPlaybackComplete?: (perspectiveId: string) => void;
  playbackMode: SWPlaybackMode;
  redirectMobileEditorPlaybackToViewer: boolean;
  resolveAudioSource: (value: string) => string;
  resolveTrackBounds: (perspective: Perspective) => PlaybackTrackBounds;
  selectedIdRef: MutableRefObject<string>;
  selectedPerspective: Perspective | null;
  setSelectedId: (id: string) => void;
  viewerPlayBehavior: ViewerPlayBehavior;
};

export const useSwPlaybackController = ({
  audioFor,
  autoStartOnLoad,
  currentTrack,
  getNextPlayablePerspective,
  hasSelectedAudio,
  isStudioSurface,
  isViewer,
  onViewerPlaybackComplete,
  playbackMode,
  redirectMobileEditorPlaybackToViewer,
  resolveAudioSource,
  resolveTrackBounds,
  selectedIdRef,
  selectedPerspective,
  setSelectedId,
  viewerPlayBehavior,
}: UseSwPlaybackControllerArgs) => {
  const router = useRouter();
  const studioPlaybackRateRef =
    useRef<(typeof STUDIO_PLAYBACK_RATES)[number]>(1);
  const [studioPlaybackRate, setStudioPlaybackRate] = useState(
    studioPlaybackRateRef.current,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackErrorById, setPlaybackErrorById] = useState<
    Record<string, AudioPlaybackError>
  >({});
  const currentTimeRef = useRef(0);
  const [renderCurrentTime, setRenderCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playIntentUntilRef = useRef(0);
  const currentTrackRef = useRef<PlaybackTrackBounds | null>(null);
  const autoStartedPerspectiveIdRef = useRef<string | null>(null);

  const commitCurrentTime = useCallback(
    (time: number, options?: { forceRender?: boolean }) => {
      if (!Number.isFinite(time)) {
        return currentTimeRef.current;
      }
      const nextTime = Math.max(0, time);
      currentTimeRef.current = nextTime;
      setRenderCurrentTime((previous) => {
        if (options?.forceRender) return nextTime;
        const delta = Math.abs(previous - nextTime);
        return delta >= PLAYBACK_SYNC_MIN_DELTA_SECONDS ? nextTime : previous;
      });
      return nextTime;
    },
    [],
  );

  const getCurrentTime = useCallback(() => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.currentTime) && audio.currentTime >= 0) {
      return audio.currentTime;
    }
    return currentTimeRef.current;
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number | null = null;
    let lastSampleMs = 0;

    const syncFromRef = (timestamp: number) => {
      if (
        lastSampleMs === 0 ||
        timestamp - lastSampleMs >= PLAYBACK_SYNC_INTERVAL_MS
      ) {
        lastSampleMs = timestamp;
        const audio = audioRef.current;
        if (
          audio &&
          Number.isFinite(audio.currentTime) &&
          audio.currentTime >= 0
        ) {
          if (audio.paused || audio.ended) {
            setIsPlaying(false);
            commitCurrentTime(audio.currentTime, { forceRender: true });
            rafId = requestAnimationFrame(syncFromRef);
            return;
          }
          commitCurrentTime(audio.currentTime);
        }
      }
      rafId = requestAnimationFrame(syncFromRef);
    };

    rafId = requestAnimationFrame(syncFromRef);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [commitCurrentTime, isPlaying]);

  useEffect(() => {
    if (isPlaying) return;
    const audio = audioRef.current;
    if (
      !audio ||
      !Number.isFinite(audio.currentTime) ||
      audio.currentTime < 0
    ) {
      return;
    }
    commitCurrentTime(audio.currentTime, { forceRender: true });
  }, [commitCurrentTime, isPlaying]);

  const applyPlaybackRate = useCallback(
    (rate?: number) => {
      const nextRate = isStudioSurface
        ? (rate ?? studioPlaybackRateRef.current)
        : 1;
      const audio = audioRef.current;
      if (audio) {
        audio.playbackRate = nextRate;
      }
      return nextRate;
    },
    [isStudioSurface],
  );

  const reportPlaybackRejection = useCallback(
    (audio: HTMLAudioElement, reason?: unknown) => {
      if (
        isPlaybackAbort({
          code: audio.error?.code ?? null,
          message: audio.error?.message ?? null,
          reason,
        })
      ) {
        return;
      }
      const activeId = selectedIdRef.current;
      if (!activeId) return;
      const message =
        audio.error?.message ??
        (reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : null);
      const currentSrc = audio.currentSrc || audio.src || "";
      const webmSupport =
        audio.canPlayType("audio/webm;codecs=opus") ||
        audio.canPlayType("audio/webm");
      const mp4Support =
        audio.canPlayType("audio/mp4;codecs=mp4a.40.2") ||
        audio.canPlayType("audio/mp4");
      const codecHint =
        /\.webm($|\?)/i.test(currentSrc) && !webmSupport
          ? `webm unsupported (webm=${webmSupport || "no"}, mp4=${
              mp4Support || "no"
            })`
          : null;
      const detailedMessage = [message, codecHint].filter(Boolean).join(" - ");
      setPlaybackErrorById((previous) => ({
        ...previous,
        [activeId]: {
          code: audio.error?.code ?? null,
          message: detailedMessage || null,
          src: currentSrc,
        },
      }));
    },
    [selectedIdRef],
  );

  const playAudioElement = useCallback(
    (audio: HTMLAudioElement, options?: { fromStart?: boolean }) => {
      try {
        playIntentUntilRef.current = performance.now() + 500;
        audio.muted = false;
        audio.volume = 1;
        if (options?.fromStart) {
          try {
            audio.currentTime = 0;
            commitCurrentTime(0, { forceRender: true });
          } catch {
            // Source may not be seekable yet.
          }
        } else if (
          Number.isFinite(audio.duration) &&
          audio.currentTime >= Math.max(0, audio.duration - 0.05)
        ) {
          try {
            audio.currentTime = 0;
            commitCurrentTime(0, { forceRender: true });
          } catch {
            // Source may not be seekable yet.
          }
        }
        const playPromise = audio.play();

        if (playPromise?.catch) {
          playPromise.catch((reason) => {
            setIsPlaying(false);
            reportPlaybackRejection(audio, reason);
          });
        }
      } catch (reason) {
        setIsPlaying(false);
        reportPlaybackRejection(audio, reason);
      }
    },
    [commitCurrentTime, reportPlaybackRejection],
  );

  const startPlayback = useCallback(
    (options?: { fromStart?: boolean }) => {
      const audio = audioRef.current;
      if (!audio) return;
      const activeId = selectedIdRef.current;
      if (activeId) {
        setPlaybackErrorById((previous) => {
          if (!(activeId in previous)) return previous;
          const next = { ...previous };
          delete next[activeId];
          return next;
        });
      }
      if (isViewer) {
        playAudioElement(audio, options);
        return;
      }
      try {
        setAudioSessionType("playback");
        applyPlaybackRate();

        const track = currentTrackRef.current;
        const seekToTrackStart = () => {
          if (!track) return;
          try {
            audio.currentTime = track.start;
            commitCurrentTime(track.start, { forceRender: true });
          } catch {
            // Source may not be seekable yet.
          }
        };

        let shouldStartFromBeginning = Boolean(options?.fromStart);
        if (track) {
          const trackEnd =
            typeof track.end === "number" && Number.isFinite(track.end)
              ? track.end
              : Number.isFinite(audio.duration)
                ? audio.duration
                : undefined;
          if (trackEnd !== undefined && audio.currentTime >= trackEnd - 0.05) {
            shouldStartFromBeginning = true;
          }
          if (shouldStartFromBeginning) {
            if (audio.readyState >= 1) {
              seekToTrackStart();
            } else {
              const onLoadedMetadata = () => {
                audio.removeEventListener("loadedmetadata", onLoadedMetadata);
                seekToTrackStart();
              };
              audio.addEventListener("loadedmetadata", onLoadedMetadata);
            }
          }
        }

        playAudioElement(audio);
      } catch (reason) {
        setIsPlaying(false);
        reportPlaybackRejection(audio, reason);
      }
    },
    [
      applyPlaybackRate,
      commitCurrentTime,
      isViewer,
      playAudioElement,
      reportPlaybackRejection,
      selectedIdRef,
    ],
  );

  useEffect(() => {
    if (!currentTrack) {
      currentTrackRef.current = null;
      return;
    }
    currentTrackRef.current = {
      start: currentTrack.start_time ?? 0,
      end: currentTrack.end_time ?? undefined,
    };
  }, [currentTrack]);

  const cycleStudioPlaybackRate = useCallback(() => {
    if (!isStudioSurface) return;
    const currentRate = studioPlaybackRateRef.current;
    const index = STUDIO_PLAYBACK_RATES.indexOf(currentRate);
    const currentIndex = index < 0 ? 0 : index;
    const nextRate =
      STUDIO_PLAYBACK_RATES[(currentIndex + 1) % STUDIO_PLAYBACK_RATES.length];
    studioPlaybackRateRef.current = nextRate;
    setStudioPlaybackRate(nextRate);
    applyPlaybackRate(nextRate);
  }, [applyPlaybackRate, isStudioSurface]);

  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) return;
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.currentTime) && audio.currentTime >= 0) {
      commitCurrentTime(audio.currentTime, { forceRender: true });
      return;
    }
    const startTime = currentTrack.start_time ?? 0;
    commitCurrentTime(startTime, { forceRender: true });
  }, [commitCurrentTime, currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      const activePerspectiveId = selectedIdRef.current;
      if (!activePerspectiveId) return;
      const nextPerspective = getNextPlayablePerspective(activePerspectiveId);
      const nextSrc = nextPerspective
        ? resolveAudioSource(audioFor(nextPerspective))
        : "";
      const nextTrack = nextPerspective
        ? resolveTrackBounds(nextPerspective)
        : { start: 0 };
      const plan = resolvePlaybackEndedPlan({
        activePerspectiveId,
        nextPerspective,
        nextSrc,
        playbackMode,
        track: nextTrack,
      });

      if (plan.action === "complete") {
        if (isViewer && onViewerPlaybackComplete) {
          onViewerPlaybackComplete(activePerspectiveId);
        }
        return;
      }

      if (!hasPlayableAudioSource(plan.src)) return;
      const currentSrc = audio.currentSrc || audio.src || "";
      if (currentSrc !== plan.src) {
        audio.src = plan.src;
      }
      currentTrackRef.current = plan.track;
      selectedIdRef.current = plan.perspective.id;
      setSelectedId(plan.perspective.id);
      startPlayback({ fromStart: true });
    };
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  }, [
    audioFor,
    getNextPlayablePerspective,
    isViewer,
    onViewerPlaybackComplete,
    playbackMode,
    resolveAudioSource,
    resolveTrackBounds,
    selectedIdRef,
    setSelectedId,
    startPlayback,
  ]);

  useEffect(() => {
    applyPlaybackRate();
  }, [applyPlaybackRate]);

  useEffect(() => {
    if (!autoStartOnLoad || !isViewer) return;
    if (viewerPlayBehavior !== "inline") return;
    if (!selectedPerspective || !hasSelectedAudio) return;
    if (autoStartedPerspectiveIdRef.current === selectedPerspective.id) return;

    const audio = audioRef.current;
    if (!audio) return;

    autoStartedPerspectiveIdRef.current = selectedPerspective.id;
    currentTrackRef.current = resolveTrackBounds(selectedPerspective);
    startPlayback({ fromStart: true });
  }, [
    autoStartOnLoad,
    hasSelectedAudio,
    isViewer,
    resolveTrackBounds,
    selectedPerspective,
    startPlayback,
    viewerPlayBehavior,
  ]);

  useEffect(() => {
    if (currentTrack) return;
    if (isPlaying) {
      setIsPlaying(false);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!isPlaying && !audio.paused) {
      if (performance.now() < playIntentUntilRef.current) {
        return;
      }
      audio.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      const currentPlaybackTime = Number.isFinite(time)
        ? time
        : getCurrentTime();
      const safeTime = Math.max(0, currentPlaybackTime);
      currentTimeRef.current = safeTime;
      if (!isPlaying) {
        commitCurrentTime(safeTime, { forceRender: true });
      }
      if (!currentTrack?.end_time) return;
      if (currentPlaybackTime < currentTrack.end_time - 0.05) return;
      commitCurrentTime(safeTime, { forceRender: true });
      setIsPlaying(false);
    },
    [commitCurrentTime, currentTrack?.end_time, getCurrentTime, isPlaying],
  );

  const handlePlayControlActivate = useCallback(
    (perspective: Perspective) => {
      setPlaybackErrorById((previous) => {
        if (!(perspective.id in previous)) return previous;
        const next = { ...previous };
        delete next[perspective.id];
        return next;
      });
      if (!hasPlayableAudioSource(audioFor(perspective))) return;

      const nextTrack = resolveTrackBounds(perspective);
      const nextSrc = resolveAudioSource(audioFor(perspective));
      const audio = audioRef.current;
      const viewerHref = `/p/${perspective.id}`;
      const isSamePerspective = selectedIdRef.current === perspective.id;

      const isMobileViewport =
        typeof window !== "undefined" &&
        (window.matchMedia("(max-width: 900px)").matches ||
          window.matchMedia("(pointer: coarse)").matches);

      if (!audio) {
        if (!isSamePerspective) {
          selectedIdRef.current = perspective.id;
          setSelectedId(perspective.id);
        }
        currentTrackRef.current = nextTrack;
        startPlayback({ fromStart: !isSamePerspective });
        return;
      }

      if (isSamePerspective) {
        const currentSrc = audio.currentSrc || audio.src || "";
        if (currentSrc !== nextSrc) {
          audio.pause();
          audio.src = nextSrc;
          audio.load();
          currentTrackRef.current = nextTrack;
          startPlayback({ fromStart: false });
          return;
        }
      }

      const plan = resolvePerspectivePlaybackPlan({
        audioCurrentTime: audio.currentTime,
        audioDuration: audio.duration,
        audioEnded: audio.ended,
        audioPaused: audio.paused,
        currentSrc: audio.currentSrc || audio.src || "",
        isMobileViewport,
        isSamePerspective,
        isStudioSurface,
        nextSrc,
        readyState: audio.readyState,
        redirectMobileEditorPlaybackToViewer,
        track: nextTrack,
        viewerHref,
      });

      if (plan.action === "navigate") {
        void router.navigate({
          href: plan.href,
          startTransition: true,
        });
        return;
      }

      if (!isSamePerspective) {
        selectedIdRef.current = perspective.id;
        setSelectedId(perspective.id);
      }

      currentTrackRef.current = nextTrack;

      if (plan.action === "pause") {
        audio.pause();
        return;
      }

      if (plan.shouldPauseFirst) {
        audio.pause();
      }
      if (plan.shouldReplaceSrc) {
        audio.src = nextSrc;
      }
      if (plan.shouldLoad) {
        audio.load();
      }

      startPlayback({
        fromStart:
          !isSamePerspective ||
          shouldStartPlaybackFromBeginning({
            currentTime: audio.currentTime,
            duration: audio.duration,
            fromStart: plan.fromStart,
            track: nextTrack,
          }),
      });
    },
    [
      audioFor,
      isStudioSurface,
      redirectMobileEditorPlaybackToViewer,
      resolveAudioSource,
      resolveTrackBounds,
      router,
      selectedIdRef,
      setSelectedId,
      startPlayback,
    ],
  );

  const handleAudioPlaybackError = useCallback(
    (error: AudioPlaybackError) => {
      if (
        isPlaybackAbort({
          code: error.code,
          message: error.message,
        })
      ) {
        return;
      }
      const activeId = selectedIdRef.current;
      if (!activeId) return;

      setPlaybackErrorById((previous) => ({
        ...previous,
        [activeId]: error,
      }));
    },
    [selectedIdRef],
  );

  const isAudioElementPlaying = Boolean(
    audioRef.current && !audioRef.current.paused && !audioRef.current.ended,
  );

  return {
    audioRef,
    commitCurrentTime,
    currentTime: renderCurrentTime,
    getCurrentTime,
    handleAudioPlaybackError,
    handlePlayControlActivate,
    handleTimeUpdate,
    isPlaybackActive: isPlaying && isAudioElementPlaying,
    isPlaying,
    playbackErrorById,
    setIsPlaying,
    studioPlaybackRate,
    cycleStudioPlaybackRate,
  };
};
