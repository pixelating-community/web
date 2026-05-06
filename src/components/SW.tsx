"use client";

import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { PerspectiveModeNav } from "@/components/PerspectiveModeNav";
import { SWEFooter, type SampleBoundSaveStatus } from "@/components/SWEFooter";
import { AudioImport } from "@/components/AudioImport";
import { LineLengthIndicator } from "@/components/LineLengthIndicator";
import { PerspectiveExportImport } from "@/components/PerspectiveExportImport";
import {
  hasPlayableAudioSource,
  perspectiveRuntimeReducer,
  WORD_START_SHIFT_SECONDS,
  type PerspectiveRuntimeState,
} from "@/components/sw/runtime";
import {
  hasRuntimeAudioOverride,
  resolveSwAudioSource,
  selectAnalysis,
  selectAudioValueForSave,
  selectCurrentTrack,
  selectNextPlayablePerspective,
  selectPerspectiveAudioValue,
  selectPerspectiveTimings,
  selectPerspectiveWords,
  selectPlaybackClock,
  selectPlaybackErrorSummary,
  selectPlayheadPercent,
  selectSelectedAudioSrc,
  selectSelectedPerspective,
  selectSelectedWord,
  selectTimingCount,
  selectTrackBounds,
} from "@/components/sw/selectors";
import { SWStudioSurface } from "@/components/sw/SWStudioSurface";
import { SwInlinePlayControl } from "@/components/sw/SwInlinePlayControl";
import { useConfirmAction } from "@/components/sw/useConfirmAction";
import { useSwDraftStore } from "@/components/sw/useSwDraftStore";
import { useSwPlaybackController } from "@/components/sw/useSwPlaybackController";
import { useSwRecording } from "@/components/sw/useSwRecording";
import { useSwTimingEditor } from "@/components/sw/useSwTimingEditor";
import { SWViewerSurface } from "@/components/sw/SWViewerSurface";
import type {
  SWSurfaceItem,
  SWPlaybackMode,
  ViewerPlayBehavior,
} from "@/components/sw/types";
import { useServerFn } from "@tanstack/react-start";
import { setPerspectiveBounds } from "@/lib/perspectiveBounds.functions";
import { getPublicAudioBaseUrl } from "@/lib/publicAudioBase";
import {
  buildTopicPerspectivePath,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
} from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

export type { SWPlaybackMode } from "@/components/sw/types";

type SampleBoundField = "startTime" | "endTime";

export const SW = ({
  actionToken,
  perspectives,
  initialId,
  scrollToId,
  topicId,
  topicName,
  canWrite = false,
  redirectMobileEditorPlaybackToViewer = false,
  mode = "editor",
  playbackProfile = "full-file",
  playbackMode = "single",
  viewerPlayBehavior = "open-perspective-page",
  showViewerEditLink = true,
  showViewerAudioControls = false,
  showPerspectiveModeNav = false,
  perspectiveNavMode,
  autoStartOnLoad = false,
  urlStartTime,
  urlEndTime,
  onViewerPlaybackComplete,
}: {
  actionToken?: string;
  perspectives: Perspective[];
  initialId: string;
  scrollToId?: string;
  topicId: string;
  topicName?: string;
  canWrite?: boolean;
  redirectMobileEditorPlaybackToViewer?: boolean;
  mode?: "editor" | "viewer";
  playbackProfile?: "database-bounds" | "full-file";
  playbackMode?: SWPlaybackMode;
  viewerPlayBehavior?: ViewerPlayBehavior;
  showViewerEditLink?: boolean;
  showViewerAudioControls?: boolean;
  showPerspectiveModeNav?: boolean;
  perspectiveNavMode?: "record" | "listen" | "karaoke-editor";
  autoStartOnLoad?: boolean;
  urlStartTime?: number;
  urlEndTime?: number;
  onViewerPlaybackComplete?: (perspectiveId: string) => void;
}) => {
  const router = useRouter();
  const currentLocation = useRouterState({
    select: (state) => state.location,
  });
  const isViewer = mode === "viewer";
  const isStudioSurface = mode === "editor";
  const isPlaybackSurface = !isStudioSurface;
  const usesDatabaseBounds = playbackProfile === "database-bounds";
  const hasAudioBase = Boolean(getPublicAudioBaseUrl());
  const [selectedId, setSelectedId] = useState(initialId);
  const selectedIdRef = useRef(initialId);
  const [runtimeById, dispatchRuntime] = useReducer(
    perspectiveRuntimeReducer,
    {},
  );
  const [sampleBoundSaveStatus, setSampleBoundSaveStatus] = useState<
    Record<SampleBoundField, SampleBoundSaveStatus>
  >({
    endTime: "idle",
    startTime: "idle",
  });
  const [sampleBoundsError, setSampleBoundsError] = useState("");
  const trackedLocalAudioUrlsRef = useRef<Set<string>>(new Set());
  const [isFooterMinimized, setIsFooterMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const initialSelectionRef = useRef<string | null>(null);
  const autoScrollTargetRef = useRef<string | null>(null);
  const hasAutoScrolledRef = useRef(false);

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

  const selectedPerspective = useMemo(
    () =>
      selectSelectedPerspective({
        perspectives,
        selectedId,
      }),
    [perspectives, selectedId],
  );

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
      selectPerspectiveAudioValue({
        perspective,
        runtimeById,
      }),
    [runtimeById],
  );

  const resolveTrackBounds = useCallback(
    (perspective: Perspective) =>
      selectTrackBounds({
        perspective,
        runtime: runtimeById[perspective.id],
        usesDatabaseBounds,
      }),
    [runtimeById, usesDatabaseBounds],
  );

  const getNextPlayablePerspective = useCallback(
    (activePerspectiveId: string) =>
      selectNextPlayablePerspective({
        activePerspectiveId,
        perspectives,
        runtimeById,
      }),
    [perspectives, runtimeById],
  );

  const audioForSave = useCallback(
    (perspective: Perspective) =>
      selectAudioValueForSave({
        perspective,
        runtimeById,
        hasAudioBase,
      }),
    [hasAudioBase, runtimeById],
  );

  const timingsFor = useCallback(
    (perspective: Perspective) =>
      selectPerspectiveTimings({
        perspective,
        runtimeById,
      }),
    [runtimeById],
  );

  const selectedRuntime = selectedPerspective
    ? runtimeById[selectedPerspective.id]
    : undefined;
  const selectedWordIndex = selectedRuntime?.selectedWordIndex;
  const selectedAudioSrc = selectSelectedAudioSrc({
    selectedPerspective,
    runtimeById,
  });
  const hasSelectedAudio = hasPlayableAudioSource(selectedAudioSrc);
  const hasSelectedAudioOverride = hasRuntimeAudioOverride(selectedRuntime);
  const selectedTimings = selectedPerspective
    ? timingsFor(selectedPerspective)
    : [];
  const currentTrack = useMemo(
    () =>
      selectCurrentTrack({
        selectedPerspective,
        selectedAudioSrc,
        hasSelectedAudio,
        hasSelectedAudioOverride,
        usesDatabaseBounds,
      }),
    [
      hasSelectedAudio,
      hasSelectedAudioOverride,
      selectedAudioSrc,
      selectedPerspective,
      usesDatabaseBounds,
    ],
  );
  const currentPath = `${currentLocation.pathname}${currentLocation.searchStr}`;

  const {
    audioRef,
    commitCurrentTime,
    currentTime,
    cycleStudioPlaybackRate,
    getCurrentTime,
    handleAudioPlaybackError,
    handlePlayControlActivate,
    handleTimeUpdate,
    isPlaybackActive,
    isPlaying,
    playbackErrorById,
    setIsPlaying,
    studioPlaybackRate,
  } = useSwPlaybackController({
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
    resolveAudioSource: resolveSwAudioSource,
    resolveTrackBounds,
    selectedIdRef,
    selectedPerspective,
    setSelectedId,
    urlEndTime,
    urlStartTime,
    viewerPlayBehavior,
  });

  const selectedPlaybackError = selectedPerspective
    ? playbackErrorById[selectedPerspective.id]
    : undefined;
  const selectedPlaybackErrorSummary = selectPlaybackErrorSummary(
    selectedPlaybackError,
  );
  const selectedPlaybackClockTime = useMemo(
    () =>
      selectPlaybackClock({
        time: currentTime,
        timings: selectedTimings,
        usesDatabaseBounds,
        perspectiveStartTime: selectedPerspective?.start_time,
      }),
    [currentTime, selectedPerspective?.start_time, selectedTimings, usesDatabaseBounds],
  );
  const selectedTimingCount = selectTimingCount(selectedTimings);
  const selectedWords = useMemo(
    () => selectPerspectiveWords(selectedPerspective),
    [selectedPerspective],
  );
  const selectedWordCount = selectedWords.length;
  const selectedWord = selectSelectedWord({
    selectedWords,
    selectedWordIndex,
  });
  const selectedAnalysis = selectAnalysis(selectedRuntime);
  const playheadPercent = selectPlayheadPercent({
    analysis: selectedAnalysis,
    playbackClockTime: selectedPlaybackClockTime,
  });

  const setSampleBoundStatus = useCallback(
    (field: SampleBoundField, status: SampleBoundSaveStatus) => {
      setSampleBoundSaveStatus((previous) => ({
        ...previous,
        [field]: status,
      }));
    },
    [],
  );

  const inferSampleDefaultEndTime = useCallback(() => {
    const audioDuration = audioRef.current?.duration;
    if (
      typeof audioDuration === "number" &&
      Number.isFinite(audioDuration) &&
      audioDuration > 0
    ) {
      return audioDuration;
    }
    if (
      typeof selectedAnalysis?.duration === "number" &&
      Number.isFinite(selectedAnalysis.duration) &&
      selectedAnalysis.duration > 0
    ) {
      return selectedAnalysis.duration;
    }
    if (
      typeof selectedPerspective?.end_time === "number" &&
      Number.isFinite(selectedPerspective.end_time) &&
      selectedPerspective.end_time > 0
    ) {
      return selectedPerspective.end_time;
    }
    let lastTimingEnd = 0;
    for (const timing of selectedTimings) {
      if (!timing) continue;
      const timingEnd =
        typeof timing.end === "number" && Number.isFinite(timing.end)
          ? timing.end
          : timing.start;
      if (Number.isFinite(timingEnd) && timingEnd > lastTimingEnd) {
        lastTimingEnd = timingEnd;
      }
    }
    return lastTimingEnd > 0 ? lastTimingEnd : undefined;
  }, [audioRef, selectedAnalysis?.duration, selectedPerspective?.end_time, selectedTimings]);

  const getSampleBoundTime = useCallback(
    (field: SampleBoundField) => {
      const current = getCurrentTime();
      const currentTime = Number.isFinite(current) ? Math.max(0, current) : 0;
      if (
        field === "endTime" &&
        selectedPerspective?.end_time === undefined &&
        currentTime <= 0.005
      ) {
        return inferSampleDefaultEndTime() ?? currentTime;
      }
      return currentTime;
    },
    [getCurrentTime, inferSampleDefaultEndTime, selectedPerspective?.end_time],
  );

  const {
    clearAllMarks,
    clearCurrentMark,
    markAndForward,
    markCurrentEnd,
    rewindToPrevious,
    shiftWordStartBackward,
    shiftWordStartForward,
  } = useSwTimingEditor({
    audioRef,
    commitCurrentTime,
    enabled: isStudioSurface,
    getCurrentTime,
    isPlaying,
    patchRuntime,
    runtimeById,
    selectedPerspective,
    selectedTimings,
    selectedWordIndex,
    setSelectedId,
  });

  const {
    handleRecorderStart,
    handleRecorderStopIntent,
    handleRecorderError,
    handleRecorderCapture,
    handleSaveTimings,
    handleDeleteAudio,
  } = useSwRecording({
    actionToken,
    currentPath,
    runtimeById,
    patchRuntime,
    selectedPerspective,
    selectedTimings,
    audioForSave,
    clearDraftTimings,
    getAudioCurrentTime: getCurrentTime,
    setIsPlaying,
    topicId,
    topicName,
  });

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

  const handleSelectWord = useCallback(
    (id: string, index: number) => {
      setSelectedId(id);
      patchRuntime(id, { selectedWordIndex: index });
    },
    [patchRuntime],
  );

  const setBoundsFn = useServerFn(setPerspectiveBounds);
  const saveSampleBound = useCallback(
    async (field: SampleBoundField) => {
      if (!selectedPerspective) return;
      if (!actionToken) {
        setSampleBoundStatus(field, "error");
        setSampleBoundsError("Missing action token");
        return;
      }
      const boundTime = getSampleBoundTime(field);
      if (!Number.isFinite(boundTime)) {
        setSampleBoundStatus(field, "error");
        setSampleBoundsError("No playback time available");
        return;
      }

      setSampleBoundStatus(field, "saving");
      setSampleBoundsError("");
      try {
        const defaultEndTime = inferSampleDefaultEndTime();
        const result = await setBoundsFn({
          data: {
            actionToken,
            currentPath,
            defaultEndTime,
            defaultStartTime: 0,
            perspectiveId: selectedPerspective.id,
            topicId,
            [field]: boundTime,
          },
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        if (result.href) {
          await router.navigate({
            href: result.href,
            replace: true,
          });
        }
        await router.invalidate();
        setSampleBoundStatus(field, "saved");
      } catch (error) {
        setSampleBoundStatus(field, "error");
        setSampleBoundsError(
          error instanceof Error ? error.message : "Failed to save sample bound",
        );
      }
    },
    [
      actionToken,
      currentPath,
      getSampleBoundTime,
      inferSampleDefaultEndTime,
      router,
      selectedPerspective,
      setBoundsFn,
      setSampleBoundStatus,
      topicId,
    ],
  );

  const handleSetSampleStart = useCallback(() => {
    void saveSampleBound("startTime");
  }, [saveSampleBound]);

  const handleSetSampleEnd = useCallback(() => {
    void saveSampleBound("endTime");
  }, [saveSampleBound]);

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

  const registerPerspectiveRef = useCallback(
    (perspectiveId: string, node: HTMLDivElement | null) => {
      editorRefs.current[perspectiveId] = node;
    },
    [],
  );

  const surfaceItems = useMemo<SWSurfaceItem[]>(
    () =>
      perspectives.map((perspective) => {
        const isActive = perspective.id === selectedId;
        const timings = timingsFor(perspective);
        const hasAudio = hasPlayableAudioSource(audioFor(perspective));
        const hasPlaybackError = Boolean(playbackErrorById[perspective.id]);
        const playDisabled = !hasAudio;
        const showViewerEditActions =
          isViewer && showViewerEditLink && canWrite && Boolean(topicName);
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
        const showInlinePlayControl = isViewer
          ? !showViewerAudioControls && (hasAudio || showViewerEditActions)
          : hasAudio &&
            isStudioSurface &&
            topicName &&
            isActive;
        const writeHref =
          showViewerEditActions && topicName
            ? buildTopicWritePerspectivePath({
                topicName,
                perspectiveId: perspective.id,
              })
            : "";
        const recordHref =
          showViewerEditActions && topicName
            ? buildTopicPerspectivePath({
                topicName,
                perspectiveId: perspective.id,
              })
            : "";
        const previewHref = topicName
          ? (() => {
              const base = buildTopicViewerPerspectivePath({
                topicName,
                perspectiveId: perspective.id,
              });
              const params = new URLSearchParams();
              if (perspective.start_time != null) params.set("s", String(perspective.start_time));
              if (perspective.end_time != null) params.set("e", String(perspective.end_time));
              const qs = params.toString();
              return qs ? `${base}?${qs}` : base;
            })()
          : "";

        return {
          currentTime: isActive ? selectedPlaybackClockTime : currentTime,
          isActive,
          leadingControl: (isStudioSurface || showInlinePlayControl) ? (
            <span className="inline-flex items-center gap-2">
              {showInlinePlayControl ? (
                <SwInlinePlayControl
                  playDisabled={playDisabled}
                  playLabel={playLabel}
                  previewHref={isStudioSurface || !hasAudio ? "" : previewHref}
                  recordHref={recordHref}
                  showStopState={showStopState}
                  writeHref={writeHref}
                  onPlayClick={isStudioSurface ? () => handlePlayControlActivate(perspective) : undefined}
                />
              ) : null}
              {isStudioSurface ? (
                <LineLengthIndicator text={perspective.perspective} />
              ) : null}
            </span>
          ) : null,
          perspective,
          selectedWordIndex: isActive ? selectedWordIndex : undefined,
          timings,
        };
      }),
    [
      audioFor,
      canWrite,
      currentTime,
      handlePlayControlActivate,
      isPlaybackActive,
      isStudioSurface,
      isViewer,
      playbackErrorById,
      perspectives,
      selectedId,
      selectedPlaybackClockTime,
      selectedWordIndex,
      showViewerAudioControls,
      showViewerEditLink,
      timingsFor,
      topicName,
      viewerPlayBehavior,
    ],
  );

  return (
    <div
      className={`flex h-dvh w-full flex-col overflow-hidden ${
        isStudioSurface ? (isFooterMinimized ? "pb-14" : "pb-32") : ""
      }`}
    >
      {showPerspectiveModeNav && topicName && selectedPerspective ? (
        <PerspectiveModeNav
          canWrite={canWrite}
          currentMode={perspectiveNavMode ?? (isViewer ? "listen" : "record")}
          perspectiveId={selectedPerspective.id}
          topicName={topicName}
        />
      ) : null}
      <div
        ref={scrollRef}
        className={`flex w-screen min-h-0 flex-1 snap-x snap-mandatory touch-pan-x items-center overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable] scrollbar-transparent ${
          isStudioSurface ? "px-4 py-0" : "px-0 py-0"
        }`}
      >
        {isViewer ? (
          <SWViewerSurface
            audioRef={audioRef}
            isPlaying={isPlaying}
            items={surfaceItems}
            onSeek={handleTimeUpdate}
            onSelectWord={handleSelectWord}
            registerPerspectiveRef={registerPerspectiveRef}
            topicName={topicName}
          />
        ) : (
          <SWStudioSurface
            audioRef={audioRef}
            isPlaying={isPlaying}
            items={surfaceItems}
            onSeek={handleTimeUpdate}
            onSelectWord={handleSelectWord}
            registerPerspectiveRef={registerPerspectiveRef}
          />
        )}
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
          showViewerAudioControls={showViewerAudioControls}
          isMinimized={isStudioSurface ? isFooterMinimized : false}
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
          onSetSampleStart={handleSetSampleStart}
          onSetSampleEnd={handleSetSampleEnd}
          sampleStartSaveStatus={sampleBoundSaveStatus.startTime}
          sampleEndSaveStatus={sampleBoundSaveStatus.endTime}
          sampleBoundsError={sampleBoundsError}
          onShiftWordStartBackward={shiftWordStartBackward}
          onShiftWordStartForward={shiftWordStartForward}
          wordShiftStepSeconds={WORD_START_SHIFT_SECONDS}
          onToggleMinimized={toggleFooterMinimized}
          onAudioError={handleAudioPlaybackError}
        >
          {actionToken &&
          !selectedPerspective.id.startsWith("pending-") ? (
            <AudioImport
              actionToken={actionToken}
              topicId={topicId}
              perspectiveId={selectedPerspective.id}
              currentAudioSrc={selectedPerspective.audio_src}
              onImported={() => router.invalidate()}
              onDeleted={() => router.invalidate()}
              availableTracks={perspectives
                .filter((p) => p.audio_src)
                .map((p) => {
                  const src = p.audio_src!;
                  let r2Key = src;
                  try {
                    const url = new URL(src, "https://x");
                    const keyParam = url.searchParams.get("key");
                    r2Key = keyParam || url.pathname.split("/").pop() || src;
                  } catch {}
                  return {
                    id: p.id,
                    label: p.perspective.slice(0, 30) || p.id.slice(0, 8),
                    r2Key,
                  };
                })}
            />
          ) : null}
          {!selectedPerspective.id.startsWith("pending-") ? (
            <PerspectiveExportImport
              perspective={selectedPerspective}
              timings={selectedTimings}
              actionToken={actionToken}
              topicId={topicId}
              onImported={() => router.invalidate()}
            />
          ) : null}
        </SWEFooter>
      ) : null}
    </div>
  );
};
