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
import { SWEFooter } from "@/components/SWEFooter";
import { AudioImport } from "@/components/AudioImport";
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
import { getPublicAudioBaseUrl } from "@/lib/publicAudioBase";
import {
  buildTopicPerspectivePath,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
} from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

export type { SWPlaybackMode } from "@/components/sw/types";

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
  autoStartOnLoad = false,
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
  autoStartOnLoad?: boolean;
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
    currentPath: `${currentLocation.pathname}${currentLocation.searchStr}`,
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
        const showInlinePlayControl = hasAudio && (
          isViewer ? !showViewerAudioControls : isActive
        );
        const writeHref =
          isViewer && showViewerEditLink && canWrite && topicName
            ? buildTopicWritePerspectivePath({
                topicName,
                perspectiveId: perspective.id,
              })
            : "";
        const recordHref =
          isViewer && showViewerEditLink && canWrite && topicName
            ? buildTopicPerspectivePath({
                topicName,
                perspectiveId: perspective.id,
              })
            : "";
        const previewHref =
          isStudioSurface && topicName && !showPerspectiveModeNav
            ? buildTopicViewerPerspectivePath({
                topicName,
                perspectiveId: perspective.id,
              })
            : "";

        return {
          currentTime: isActive ? selectedPlaybackClockTime : currentTime,
          isActive,
          leadingControl: showInlinePlayControl ? (
            <SwInlinePlayControl
              hasPlaybackError={hasPlaybackError}
              playDisabled={playDisabled}
              playLabel={playLabel}
              previewHref={previewHref}
              recordHref={recordHref}
              showStopState={showStopState}
              writeHref={writeHref}
              onPlayClick={() => {
                if (
                  isViewer &&
                  viewerPlayBehavior === "open-perspective-page"
                ) {
                  void router.navigate({
                    href: topicName
                      ? buildTopicViewerPerspectivePath({
                          topicName,
                          perspectiveId: perspective.id,
                        })
                      : `/p/${perspective.id}`,
                    startTransition: true,
                  });
                  return;
                }
                handlePlayControlActivate(perspective);
              }}
            />
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
      router,
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
          currentMode={isViewer ? "listen" : "record"}
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
            perspectiveHref={
              canWrite && topicName
                ? (id) => buildTopicWritePerspectivePath({ topicName, perspectiveId: id })
                : undefined
            }
            registerPerspectiveRef={registerPerspectiveRef}
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
        </SWEFooter>
      ) : null}
    </div>
  );
};
