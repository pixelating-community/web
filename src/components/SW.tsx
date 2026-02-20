"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { SWEditor } from "@/components/SWEditor";
import { SWEFooter } from "@/components/SWEFooter";
import {
  coerceTimingEntry,
  getPerspectiveWords,
} from "@/components/sw/editorUtils";
import { useConfirmAction } from "@/components/sw/useConfirmAction";
import {
  DEFAULT_WORD_DURATION,
  hasPlayableAudioSource,
  isLocalAudioUrl,
  isTextInputTarget,
  type PerspectiveRuntimeState,
  perspectiveRuntimeReducer,
  resolvePlaybackClockTime,
  roundToHundredths,
  STUDIO_PLAYBACK_RATES,
  WORD_START_SHIFT_SECONDS,
} from "@/components/sw/runtime";
import { useSwDraftStore } from "@/components/sw/useSwDraftStore";
import { useSwMidiControls } from "@/components/sw/useSwMidiControls";
import { useSwRecording } from "@/components/sw/useSwRecording";
import { MIN_WORD_SECONDS } from "@/lib/audioProcessing";
import {
  buildPublicAudioUrl,
  getPublicAudioBaseUrl,
} from "@/lib/publicAudioBase";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

const PLAYBACK_SYNC_MAX_FPS = 24;
const PLAYBACK_SYNC_INTERVAL_MS = 1000 / PLAYBACK_SYNC_MAX_FPS;
const PLAYBACK_SYNC_MIN_DELTA_SECONDS = 0.005;
export type SWPlaybackMode = "single" | "sequence";
type ViewerPlayBehavior = "inline" | "open-perspective-page";
type AudioPlaybackError = {
  code: number | null;
  message: string | null;
  src: string;
};

const isPlaybackAbort = (payload: {
  code?: number | null;
  message?: string | null;
  reason?: unknown;
}) => {
  if (payload.code === 1) return true;
  const reason = payload.reason;
  if (reason instanceof DOMException && reason.name === "AbortError") {
    return true;
  }
  if (
    reason &&
    typeof reason === "object" &&
    "name" in reason &&
    (reason as { name?: unknown }).name === "AbortError"
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
  return /operation was aborted|aborted/i.test(message);
};

export const SW = ({
  perspectives,
  initialId,
  scrollToId,
  topicId,
  mode = "editor",
  playbackProfile = "full-file",
  playbackMode = "single",
  viewerPlayBehavior = "open-perspective-page",
  onViewerPlaybackComplete,
}: {
  perspectives: Perspective[];
  initialId: string;
  scrollToId?: string;
  topicId: string;
  mode?: "editor" | "viewer";
  playbackProfile?: "database-bounds" | "full-file";
  playbackMode?: SWPlaybackMode;
  viewerPlayBehavior?: ViewerPlayBehavior;
  onViewerPlaybackComplete?: (perspectiveId: string) => void;
}) => {
  const isViewer = mode === "viewer";
  const isStudioSurface = mode === "editor";
  const isPlaybackSurface = !isStudioSurface;
  const usesDatabaseBounds = playbackProfile === "database-bounds";
  const hasAudioBase = Boolean(getPublicAudioBaseUrl());
  const [selectedId, setSelectedId] = useState(initialId);
  const studioPlaybackRateRef =
    useRef<(typeof STUDIO_PLAYBACK_RATES)[number]>(1);
  const [studioPlaybackRate, setStudioPlaybackRate] = useState(
    studioPlaybackRateRef.current,
  );
  const selectedIdRef = useRef(initialId);
  const [runtimeById, dispatchRuntime] = useReducer(
    perspectiveRuntimeReducer,
    {},
  );
  const trackedLocalAudioUrlsRef = useRef<Set<string>>(new Set());
  const [isFooterMinimized, setIsFooterMinimized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackErrorById, setPlaybackErrorById] = useState<
    Record<string, AudioPlaybackError>
  >({});
  const currentTimeRef = useRef(0);
  const [renderCurrentTime, setRenderCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrackRef = useRef<{
    end?: number;
    start: number;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const initialSelectionRef = useRef<string | null>(null);
  const autoScrollTargetRef = useRef<string | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const playbackModeRef = useRef<SWPlaybackMode>(playbackMode);
  useEffect(() => {
    playbackModeRef.current = playbackMode;
  }, [playbackMode]);
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
  const patchRuntime = useCallback(
    (id: string, patch: Partial<PerspectiveRuntimeState>) => {
      dispatchRuntime({ type: "patch", id, patch });
    },
    [],
  );
  useEffect(() => {
    if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
      return;
    }
    const nextUrls = new Set<string>();
    for (const runtime of Object.values(runtimeById)) {
      const localAudioUrl = runtime.localAudioOverride?.trim();
      if (!localAudioUrl?.startsWith("blob:")) continue;
      nextUrls.add(localAudioUrl);
    }
    for (const previousUrl of trackedLocalAudioUrlsRef.current) {
      if (nextUrls.has(previousUrl)) continue;
      URL.revokeObjectURL(previousUrl);
    }
    trackedLocalAudioUrlsRef.current = nextUrls;
  }, [runtimeById]);
  useEffect(
    () => () => {
      if (
        typeof URL === "undefined" ||
        typeof URL.revokeObjectURL !== "function"
      ) {
        return;
      }
      for (const localAudioUrl of trackedLocalAudioUrlsRef.current) {
        URL.revokeObjectURL(localAudioUrl);
      }
      trackedLocalAudioUrlsRef.current.clear();
    },
    [],
  );
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
    [],
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
      try {
        const track = currentTrackRef.current;
        const seekToTrackStart = () => {
          if (!track) return;
          try {
            audio.currentTime = track.start;
            commitCurrentTime(track.start, { forceRender: true });
          } catch {
            // Source may not be seekable until metadata is loaded.
          }
        };
        if (track) {
          if (options?.fromStart) {
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
          const trackEnd =
            typeof track.end === "number" && Number.isFinite(track.end)
              ? track.end
              : Number.isFinite(audio.duration)
                ? audio.duration
                : undefined;
          if (trackEnd !== undefined && audio.currentTime >= trackEnd - 0.05) {
            seekToTrackStart();
          }
        }

        audio.muted = false;
        audio.volume = 1;
        applyPlaybackRate();
        const currentSource = audio.currentSrc || audio.src || "";
        if (/\.webm($|\?)/i.test(currentSource)) {
          const canPlayWebm =
            audio.canPlayType("audio/webm;codecs=opus") ||
            audio.canPlayType("audio/webm");
          if (!canPlayWebm) {
            setIsPlaying(false);
            reportPlaybackRejection(audio, "WebM/Opus is not playable here");
            return;
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
    [applyPlaybackRate, commitCurrentTime, reportPlaybackRejection],
  );
  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }

    audio.play().catch(() => {
    });

    startPlayback();
  }, [startPlayback]);
  const selectedPerspective = useMemo(() => {
    return (
      perspectives.find((perspective) => perspective.id === selectedId) ??
      perspectives[0] ??
      null
    );
  }, [perspectives, selectedId]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const { writeDraftTimings, clearDraftTimings } = useSwDraftStore({
    topicId,
    perspectives,
    runtimeById,
    patchRuntime,
  });

  const audioFor = useCallback(
    (perspective: Perspective) =>
      runtimeById[perspective.id]?.localAudioOverride ??
      runtimeById[perspective.id]?.audioOverride ??
      perspective.audio_src ??
      "",
    [runtimeById],
  );
  const resolveAudioSource = useCallback((value: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("data:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    ) {
      return trimmed;
    }
    return buildPublicAudioUrl(trimmed);
  }, []);
  const resolveTrackBounds = useCallback(
    (perspective: Perspective) => {
      const hasRuntimeAudioOverride = Boolean(
        runtimeById[perspective.id]?.localAudioOverride ??
        runtimeById[perspective.id]?.audioOverride ??
        runtimeById[perspective.id]?.audioKeyOverride,
      );
      if (!hasRuntimeAudioOverride && usesDatabaseBounds) {
        return {
          start: perspective.start_time ?? 0,
          end: perspective.end_time ?? undefined,
        };
      }
      return {
        start: 0,
        end: undefined,
      };
    },
    [runtimeById, usesDatabaseBounds],
  );
  const getNextPlayablePerspective = useCallback(
    (activePerspectiveId: string) => {
      const activeIndex = perspectives.findIndex(
        (perspective) => perspective.id === activePerspectiveId,
      );
      if (activeIndex < 0) return null;
      for (let index = activeIndex + 1; index < perspectives.length; index++) {
        const candidate = perspectives[index];
        const candidateSrc = resolveAudioSource(audioFor(candidate));
        if (hasPlayableAudioSource(candidateSrc)) {
          return candidate;
        }
      }
      return null;
    },
    [audioFor, perspectives, resolveAudioSource],
  );
  const audioForSave = useCallback(
    (perspective: Perspective) => {
      const override = runtimeById[perspective.id]?.audioOverride;
      const stored = perspective.audio_src;
      const safeOverride = isLocalAudioUrl(override) ? undefined : override;
      const safeStored = isLocalAudioUrl(stored) ? undefined : stored;
      return hasAudioBase
        ? (runtimeById[perspective.id]?.audioKeyOverride ??
            safeOverride ??
            safeStored ??
            "")
        : (safeOverride ??
            safeStored ??
            runtimeById[perspective.id]?.audioKeyOverride ??
            "");
    },
    [hasAudioBase, runtimeById],
  );

  const timingsFor = useCallback(
    (perspective: Perspective) => {
      const sourceTimings =
        runtimeById[perspective.id]?.timings ?? perspective.wordTimings ?? [];
      const words = getPerspectiveWords(perspective);
      if (words.length === 0) return sourceTimings;
      return Array.from({ length: words.length }, (_, index) => {
        const entry = sourceTimings[index];
        return entry === undefined ? null : entry;
      });
    },
    [runtimeById],
  );

  const selectedWordIndex = selectedPerspective
    ? runtimeById[selectedPerspective.id]?.selectedWordIndex
    : undefined;
  const selectedPlaybackError = selectedPerspective
    ? playbackErrorById[selectedPerspective.id]
    : undefined;
  const selectedPlaybackErrorSummary = selectedPlaybackError
    ? [
        selectedPlaybackError.code !== null
          ? `code ${selectedPlaybackError.code}`
          : null,
        selectedPlaybackError.message?.trim() || null,
      ]
        .filter(Boolean)
        .join(" - ")
    : "";

  const selectedAudioSrc = selectedPerspective
    ? resolveAudioSource(audioFor(selectedPerspective))
    : "";
  const isAudioElementPlaying = Boolean(
    audioRef.current && !audioRef.current.paused && !audioRef.current.ended,
  );
  const isPlaybackActive = isPlaying && isAudioElementPlaying;
  const hasSelectedAudio = hasPlayableAudioSource(selectedAudioSrc);
  const selectedRuntime = selectedPerspective
    ? runtimeById[selectedPerspective.id]
    : undefined;
  const hasSelectedAudioOverride = Boolean(
    selectedRuntime?.localAudioOverride ??
    selectedRuntime?.audioOverride ??
    selectedRuntime?.audioKeyOverride,
  );
  const selectedTimings = selectedPerspective
    ? timingsFor(selectedPerspective)
    : [];
  const currentTime = renderCurrentTime;
  const selectedPlaybackClockTime = useMemo(
    () =>
      resolvePlaybackClockTime({
        time: currentTime,
        timings: selectedTimings,
        trackStartTime: usesDatabaseBounds
          ? (selectedPerspective?.start_time ?? undefined)
          : undefined,
      }),
    [
      currentTime,
      selectedPerspective?.start_time,
      selectedTimings,
      usesDatabaseBounds,
    ],
  );
  const selectedTimingCount = selectedTimings.filter(Boolean).length;
  const selectedWordCount = useMemo(
    () =>
      selectedPerspective ? getPerspectiveWords(selectedPerspective).length : 0,
    [selectedPerspective],
  );
  const currentTrack = useMemo(() => {
    if (!selectedPerspective || !hasSelectedAudio) return null;
    if (!hasSelectedAudioOverride && usesDatabaseBounds) {
      return { ...selectedPerspective, audio_src: selectedAudioSrc };
    }
    // Full-file playback profile ignores DB start/end bounds.
    return {
      ...selectedPerspective,
      audio_src: selectedAudioSrc,
      start_time: 0,
      end_time: undefined,
    };
  }, [
    hasSelectedAudio,
    hasSelectedAudioOverride,
    selectedAudioSrc,
    selectedPerspective,
    usesDatabaseBounds,
  ]);
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
  const selectedAnalysis = selectedPerspective
    ? (runtimeById[selectedPerspective.id]?.analysis ?? null)
    : null;
  const playheadPercent =
    selectedAnalysis && selectedAnalysis.duration > 0
      ? Math.min(
          100,
          (selectedPlaybackClockTime / selectedAnalysis.duration) * 100,
        )
      : 0;

  const selectedIndex = useMemo(
    () =>
      perspectives.findIndex((perspective) => perspective.id === selectedId),
    [perspectives, selectedId],
  );
  const hasMultiplePerspectives = perspectives.length > 1;
  const selectedLabel =
    selectedIndex >= 0 && hasMultiplePerspectives
      ? `sw ${selectedIndex + 1}/${perspectives.length}`
      : "sw";
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
  const selectedWords = selectedPerspective
    ? getPerspectiveWords(selectedPerspective)
    : [];
  const selectedWord =
    selectedWordIndex !== undefined && selectedWordIndex >= 0
      ? selectedWords[selectedWordIndex]
      : "";

  useEffect(() => {
    if (!isStudioSurface) return;
    setIsFooterMinimized(false);
  }, [isStudioSurface]);

  const toggleFooterMinimized = useCallback(() => {
    setIsFooterMinimized((previous) => !previous);
  }, []);

  useEffect(() => {
    if (!scrollToId) return;
    if (!perspectives.some((perspective) => perspective.id === scrollToId)) {
      return;
    }
    if (selectedIdRef.current === scrollToId) return;
    selectedIdRef.current = scrollToId;
    initialSelectionRef.current = scrollToId;
    autoScrollTargetRef.current = scrollToId;
    hasAutoScrolledRef.current = false;
    setSelectedId(scrollToId);
  }, [perspectives, scrollToId]);

  useEffect(() => {
    if (!perspectives.length || initialSelectionRef.current) return;
    const hasRequested =
      Boolean(scrollToId) && perspectives.some((p) => p.id === scrollToId);
    const targetId = hasRequested
      ? (scrollToId ?? initialId)
      : perspectives.some((p) => p.id === initialId)
        ? initialId
        : perspectives[0].id;
    initialSelectionRef.current = targetId;
    selectedIdRef.current = targetId;
    setSelectedId(targetId);
    const shouldAutoScrollToTarget =
      hasRequested || (isViewer && targetId !== perspectives[0].id);
    if (shouldAutoScrollToTarget) {
      autoScrollTargetRef.current = targetId;
      hasAutoScrolledRef.current = false;
    }
  }, [initialId, isViewer, perspectives, scrollToId]);

  useEffect(() => {
    if (hasAutoScrolledRef.current) return;
    const targetId = autoScrollTargetRef.current;
    if (!targetId) return;
    const target = editorRefs.current[targetId];
    if (!target) return;
    hasAutoScrolledRef.current = true;
    target.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    if (isViewer) return;
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;

    const visibilityById = new Map<string, number>();
    let rafId: number | null = null;

    const commitSelection = () => {
      rafId = null;
      let nextId = selectedIdRef.current;
      let bestRatio = -1;
      for (const perspective of perspectives) {
        const ratio = visibilityById.get(perspective.id) ?? 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          nextId = perspective.id;
        }
      }
      if (nextId && nextId !== selectedIdRef.current) {
        selectedIdRef.current = nextId;
        setSelectedId(nextId);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const id = element.dataset.id;
          if (!id) continue;
          visibilityById.set(
            id,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        }
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(commitSelection);
      },
      {
        root,
        threshold: [0.25, 0.5, 0.75, 0.9],
      },
    );

    for (const perspective of perspectives) {
      const node = editorRefs.current[perspective.id];
      if (!node) continue;
      observer.observe(node);
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      observer.disconnect();
    };
  }, [isViewer, perspectives]);

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
      if (playbackModeRef.current !== "sequence") {
        if (isViewer && onViewerPlaybackComplete) {
          onViewerPlaybackComplete(activePerspectiveId);
        }
        return;
      }
      const nextPerspective = getNextPlayablePerspective(activePerspectiveId);
      if (!nextPerspective) {
        if (isViewer && onViewerPlaybackComplete) {
          onViewerPlaybackComplete(activePerspectiveId);
        }
        return;
      }
      const nextSrc = resolveAudioSource(audioFor(nextPerspective));
      if (!hasPlayableAudioSource(nextSrc)) return;

      const currentSrc = audio.currentSrc || audio.src || "";
      if (currentSrc !== nextSrc) {
        audio.src = nextSrc;
      }
      currentTrackRef.current = resolveTrackBounds(nextPerspective);
      selectedIdRef.current = nextPerspective.id;
      setSelectedId(nextPerspective.id);
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
    resolveAudioSource,
    resolveTrackBounds,
    startPlayback,
  ]);

  useEffect(() => {
    applyPlaybackRate();
  }, [applyPlaybackRate]);

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

  const handleSelectWord = useCallback(
    (id: string, index: number) => {
      setSelectedId(id);
      patchRuntime(id, { selectedWordIndex: index });
    },
    [patchRuntime],
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

      const isSamePerspective = selectedIdRef.current === perspective.id;

      if (!isSamePerspective) {
        setSelectedId(perspective.id);
        selectedIdRef.current = perspective.id;
        const audio = audioRef.current;
        if (audio) {
          audio.pause();
          const nextSrc = resolveAudioSource(audioFor(perspective));
          if (audio.src !== nextSrc) {
            audio.src = nextSrc;
          }
          currentTrackRef.current = resolveTrackBounds(perspective);
          audio.play().catch(() => {});
          startPlayback();
        }
        return;
      }
      togglePlayback();
    },
    [
      audioFor,
      resolveAudioSource,
      resolveTrackBounds,
      startPlayback,
      togglePlayback,
    ],
  );
  const handleAudioPlaybackError = useCallback((error: AudioPlaybackError) => {
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
  }, []);

  const updateTimingEntry = useCallback(
    (index: number, next: WordTimingEntry | null) => {
      if (!selectedPerspective) return;
      const perspectiveId = selectedPerspective.id;
      const runtimeState = runtimeById[perspectiveId];
      const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
      const words = getPerspectiveWords(selectedPerspective);
      const length = words.length;
      const existingTimings =
        runtimeState?.timings ?? selectedPerspective.wordTimings ?? [];
      const nextTimings = Array.from({ length }, (_, i) =>
        existingTimings[i] === undefined
          ? null
          : (existingTimings[i] as WordTimingEntry),
      );
      nextTimings[index] = next ?? null;
      patchRuntime(perspectiveId, {
        timings: nextTimings,
        timingsRevision: nextRevision,
        dirtyTimings: true,
      });
    },
    [patchRuntime, runtimeById, selectedPerspective],
  );

  const setTimingStart = useCallback(
    (index: number, start: number) => {
      const existing = selectedTimings[index];
      const safeStart = Math.max(0, start);
      const rawEnd =
        existing && typeof existing === "object" ? existing.end : undefined;
      const end =
        typeof rawEnd === "number" && Number.isFinite(rawEnd)
          ? Math.max(safeStart + MIN_WORD_SECONDS, rawEnd)
          : undefined;
      updateTimingEntry(index, { start: safeStart, end });
    },
    [selectedTimings, updateTimingEntry],
  );

  const setTimingEnd = useCallback(
    (index: number, end: number) => {
      const existing = selectedTimings[index];
      const start =
        existing && typeof existing === "object"
          ? existing.start
          : Math.max(0, end - DEFAULT_WORD_DURATION);
      const safeEnd = Math.max(start + MIN_WORD_SECONDS, end);
      updateTimingEntry(index, { start, end: safeEnd });
    },
    [selectedTimings, updateTimingEntry],
  );

  const shiftSelectedWordStart = useCallback(
    (delta: number) => {
      if (!selectedPerspective) return;
      const words = getPerspectiveWords(selectedPerspective);
      if (words.length === 0) return;
      const currentIndex =
        selectedWordIndex !== undefined && selectedWordIndex >= 0
          ? selectedWordIndex
          : 0;
      const existing = coerceTimingEntry(selectedTimings, currentIndex);
      const baseStart = existing ? existing.start : getCurrentTime();
      const nextStart = Math.max(0, roundToHundredths(baseStart + delta));
      setTimingStart(currentIndex, nextStart);
      setSelectedId(selectedPerspective.id);
      patchRuntime(selectedPerspective.id, { selectedWordIndex: currentIndex });
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = nextStart;
      }
      commitCurrentTime(nextStart);
      if (audio && isPlaying) {
        audio.play().catch(() => {});
      }
    },
    [
      commitCurrentTime,
      getCurrentTime,
      isPlaying,
      patchRuntime,
      selectedPerspective,
      selectedTimings,
      selectedWordIndex,
      setTimingStart,
    ],
  );

  const shiftWordStartBackward = useCallback(() => {
    shiftSelectedWordStart(-WORD_START_SHIFT_SECONDS);
  }, [shiftSelectedWordStart]);

  const shiftWordStartForward = useCallback(() => {
    shiftSelectedWordStart(WORD_START_SHIFT_SECONDS);
  }, [shiftSelectedWordStart]);

  const markAndForward = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex =
      selectedWordIndex !== undefined && selectedWordIndex >= 0
        ? selectedWordIndex
        : 0;
    setTimingStart(currentIndex, getCurrentTime());
    const nextIndex = Math.min(words.length - 1, currentIndex + 1);
    setSelectedId(selectedPerspective.id);
    patchRuntime(selectedPerspective.id, { selectedWordIndex: nextIndex });
  }, [
    getCurrentTime,
    patchRuntime,
    selectedPerspective,
    selectedWordIndex,
    setTimingStart,
  ]);

  const undoLastMark = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex =
      selectedWordIndex !== undefined && selectedWordIndex >= 0
        ? selectedWordIndex
        : 0;
    const targetIndex = Math.max(0, currentIndex - 1);
    const previousTiming = coerceTimingEntry(selectedTimings, targetIndex);
    updateTimingEntry(targetIndex, null);
    setSelectedId(selectedPerspective.id);
    patchRuntime(selectedPerspective.id, { selectedWordIndex: targetIndex });
    const seekTime = previousTiming?.start ?? 0;
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seekTime;
    }
    commitCurrentTime(seekTime);
    if (audio && isPlaying) {
      audio.play().catch(() => {});
    }
  }, [
    commitCurrentTime,
    isPlaying,
    patchRuntime,
    selectedPerspective,
    selectedTimings,
    selectedWordIndex,
    updateTimingEntry,
  ]);

  const rewindToPrevious = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex =
      selectedWordIndex !== undefined && selectedWordIndex >= 0
        ? selectedWordIndex
        : 0;
    const prevIndex = Math.max(0, currentIndex - 1);
    setSelectedId(selectedPerspective.id);
    patchRuntime(selectedPerspective.id, { selectedWordIndex: prevIndex });
    const timing = coerceTimingEntry(selectedTimings, prevIndex);
    const audio = audioRef.current;
    if (audio && timing) {
      audio.currentTime = timing.start;
    }
    if (timing) {
      commitCurrentTime(timing.start);
    }
    if (audio && timing && isPlaying) {
      audio.play().catch(() => {});
    }
  }, [
    commitCurrentTime,
    isPlaying,
    patchRuntime,
    selectedPerspective,
    selectedTimings,
    selectedWordIndex,
  ]);

  const markCurrentEnd = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex =
      selectedWordIndex !== undefined && selectedWordIndex >= 0
        ? selectedWordIndex
        : 0;
    setTimingEnd(currentIndex, getCurrentTime());
  }, [getCurrentTime, selectedPerspective, selectedWordIndex, setTimingEnd]);

  const clearCurrentMark = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex =
      selectedWordIndex !== undefined && selectedWordIndex >= 0
        ? selectedWordIndex
        : 0;
    updateTimingEntry(currentIndex, null);
  }, [selectedPerspective, selectedWordIndex, updateTimingEntry]);

  const clearAllMarks = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const perspectiveId = selectedPerspective.id;
    const runtimeState = runtimeById[perspectiveId];
    const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
    const clearedTimings: WordTimingEntry[] = Array.from(
      { length: words.length },
      () => null,
    );
    patchRuntime(perspectiveId, {
      timings: clearedTimings,
      timingsRevision: nextRevision,
      dirtyTimings: true,
    });
  }, [patchRuntime, runtimeById, selectedPerspective]);

  useEffect(() => {
    if (!selectedPerspective || !isStudioSurface) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) return;
      if (
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown"
      ) {
        return;
      }
      event.preventDefault();

      if (event.key === "ArrowRight") {
        markAndForward();
        return;
      }

      if (event.key === "ArrowUp") {
        clearCurrentMark();
        return;
      }

      if (event.key === "ArrowDown") {
        markCurrentEnd();
        return;
      }
      rewindToPrevious();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isStudioSurface,
    clearCurrentMark,
    markAndForward,
    markCurrentEnd,
    rewindToPrevious,
    selectedPerspective,
  ]);

  useSwMidiControls({
    enabled: isStudioSurface,
    onMarkAndForward: markAndForward,
    onUndoLastMark: undoLastMark,
    onShiftSelectedWordStart: shiftSelectedWordStart,
  });

  const {
    handleRecorderStart,
    handleRecorderStopIntent,
    handleRecorderError,
    handleRecorderCapture,
    handleSaveTimings,
    handleDeleteAudio,
  } = useSwRecording({
    runtimeById,
    patchRuntime,
    selectedPerspective,
    selectedTimings,
    audioForSave,
    clearDraftTimings,
    setIsPlaying,
  });

  useEffect(() => {
    if (!isStudioSurface || !selectedPerspective) return;
    const id = selectedPerspective.id;
    const runtime = runtimeById[id];
    if (!runtime?.dirtyTimings) return;
    const revision = runtime.timingsRevision ?? 0;
    if (revision <= 0) return;
    if (runtime.lastSavedRevision === revision) return;
    if (runtime.lastDraftRevision === revision) return;
    writeDraftTimings(id, selectedTimings);
    patchRuntime(id, { lastDraftRevision: revision });
  }, [
    isStudioSurface,
    patchRuntime,
    runtimeById,
    selectedPerspective,
    selectedTimings,
    writeDraftTimings,
  ]);

  const selectedRecordingState = selectedRuntime?.recording;
  const recordingStatus = selectedRecordingState?.status ?? "idle";
  const isBusy =
    recordingStatus === "uploading" || recordingStatus === "saving";
  const hasTimings = selectedTimings.some(Boolean);
  const isRecentlySaved = Boolean(selectedRuntime?.saveSuccess);
  const {
    armed: isClearCurrentMarkArmed,
    trigger: triggerClearCurrentMark,
  } = useConfirmAction({
    enabled: !isBusy && selectedWordCount > 0 && Boolean(selectedPerspective),
    onConfirm: clearCurrentMark,
    resetKey: `${selectedId}:${selectedWordIndex ?? -1}`,
  });
  const handleClearCurrentMark = useCallback(() => {
    void triggerClearCurrentMark();
  }, [triggerClearCurrentMark]);
  return (
    <div
      className={`flex flex-col h-dvh w-full overflow-hidden ${
        isStudioSurface ? (isFooterMinimized ? "pb-14" : "pb-32") : ""
      }`}
    >
      <div
        ref={scrollRef}
        className={`flex w-screen flex-1 min-h-0 overflow-x-auto [scrollbar-gutter:stable] overflow-y-hidden snap-x snap-mandatory scrollbar-transparent touch-pan-x ${
          isStudioSurface ? "items-center px-4 py-0" : "items-center px-0 py-0"
        }`}
      >
        {perspectives.map((perspective) => {
          const isActive = perspective.id === selectedId;
          const timings = timingsFor(perspective);
          const hasAudio = hasPlayableAudioSource(audioFor(perspective));
          const hasPlaybackError = Boolean(playbackErrorById[perspective.id]);
          const playDisabled = !hasAudio;
          const showStopState =
            !playDisabled && !hasPlaybackError && isActive && isPlaybackActive;
          const playLabel =
            isViewer && viewerPlayBehavior === "open-perspective-page"
            ? "Open playback page"
            : hasPlaybackError
              ? "Audio unavailable"
              : isActive && isPlaybackActive
                ? "Pause audio"
                : "Play audio";
          const showInlinePlayControl = hasAudio && isActive;
          const inlineControlSizeClass = showStopState
            ? "h-11 w-11 text-[1rem]"
            : "h-11 w-11 text-[1.2rem]";
          const inlinePlayControl = showInlinePlayControl ? (
            <button
              key={`play-${perspective.id}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                if (isViewer && viewerPlayBehavior === "open-perspective-page") {
                  window.location.assign(`/p/${perspective.id}`);
                  return;
                }
                handlePlayControlActivate(perspective);
              }}
              disabled={playDisabled}
              aria-label={playLabel}
              title={playLabel}
              className={`inline-flex ${inlineControlSizeClass} touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none transition-[color,transform,width,height] duration-150 ${
                playDisabled
                  ? "cursor-not-allowed text-white/30"
                  : hasPlaybackError
                    ? "text-red-200"
                    : showStopState
                      ? "text-teal-200"
                      : "text-(--color-neon-teal)"
              }`}
            >
              {hasPlaybackError ? "!" : showStopState ? "■" : "▶"}
            </button>
          ) : null;
          return isViewer ? (
            <div
              key={perspective.id}
              ref={(node) => {
                editorRefs.current[perspective.id] = node;
              }}
              data-id={perspective.id}
              className="defer-offscreen flex h-full min-w-[80vw] snap-center items-center justify-center p-4"
            >
              <div className="flex flex-col items-center justify-center w-full h-full">
                <div className="w-full">
                  <SWEditor
                    perspective={perspective}
                    timings={timings}
                    audioRef={audioRef}
                    currentTime={
                      isActive ? selectedPlaybackClockTime : currentTime
                    }
                    isPlaying={isPlaying}
                    isActive={isActive}
                    onSeek={handleTimeUpdate}
                    readOnly={isViewer}
                    showTimingLabels={false}
                    showSelection={false}
                    selectedWordIndex={isActive ? selectedWordIndex : undefined}
                    onSelectWord={(index) =>
                      handleSelectWord(perspective.id, index)
                    }
                    leadingControl={inlinePlayControl}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              key={perspective.id}
              ref={(node) => {
                editorRefs.current[perspective.id] = node;
              }}
              data-id={perspective.id}
              className="defer-offscreen flex h-full min-w-[90vw] snap-center items-center justify-center py-4"
            >
              <div className="flex flex-col justify-center w-full h-full gap-2">
                <div>
                  <SWEditor
                    perspective={perspective}
                    timings={timings}
                    audioRef={audioRef}
                    currentTime={
                      isActive ? selectedPlaybackClockTime : currentTime
                    }
                    isPlaying={isPlaying}
                    isActive={isActive}
                    onSeek={handleTimeUpdate}
                    readOnly={true}
                    showTimingLabels={isStudioSurface}
                    showSelection={isStudioSurface}
                    selectedWordIndex={isActive ? selectedWordIndex : undefined}
                    onSelectWord={(index) =>
                      handleSelectWord(perspective.id, index)
                    }
                    leadingControl={inlinePlayControl}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {selectedPlaybackError ? (
        <output className="px-4 pb-2 text-xs text-red-200/90">
          audio unavailable for this perspective
          {selectedPlaybackErrorSummary
            ? ` (${selectedPlaybackErrorSummary})`
            : ""}
        </output>
      ) : null}
      {selectedPerspective ? (
        <SWEFooter
          isViewer={isPlaybackSurface}
          isMinimized={isStudioSurface ? isFooterMinimized : false}
          selectedLabel={selectedLabel}
          isBusy={isBusy}
          hasTimings={hasTimings}
          isRecentlySaved={isRecentlySaved}
          studioPlaybackRate={studioPlaybackRate}
          recordingStatus={recordingStatus}
          recordingError={selectedRecordingState?.error}
          selectedTimingCount={selectedTimingCount}
          selectedWordCount={selectedWordCount}
          selectedWordIndex={selectedWordIndex}
          selectedWord={selectedWord}
          currentTrack={currentTrack}
          selectedAnalysis={selectedAnalysis}
          playheadPercent={playheadPercent}
          isPlaying={isPlaying}
          audioRef={audioRef}
          onRecorderStart={handleRecorderStart}
          onRecorderStopIntent={handleRecorderStopIntent}
          onRecorderCapture={handleRecorderCapture}
          onRecorderError={handleRecorderError}
          onSaveTimings={handleSaveTimings}
          onDeleteAudio={handleDeleteAudio}
          onCycleStudioPlaybackRate={cycleStudioPlaybackRate}
          onRewindToPrevious={rewindToPrevious}
          onMarkAndForward={markAndForward}
          onMarkCurrentEnd={markCurrentEnd}
          onClearCurrentMark={handleClearCurrentMark}
          isClearCurrentMarkArmed={isClearCurrentMarkArmed}
          onClearAllMarks={clearAllMarks}
          hasRecordedAudio={hasSelectedAudio}
          onAudioTimeUpdate={handleTimeUpdate}
          setIsPlaying={setIsPlaying}
          onShiftWordStartBackward={shiftWordStartBackward}
          onShiftWordStartForward={shiftWordStartForward}
          wordShiftStepSeconds={WORD_START_SHIFT_SECONDS}
          onToggleMinimized={toggleFooterMinimized}
          onAudioError={handleAudioPlaybackError}
        />
      ) : null}
    </div>
  );
};
