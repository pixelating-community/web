"use client";

import { useCallback, useEffect, type RefObject } from "react";
import {
  coerceTimingEntry,
  getPerspectiveWords,
} from "@/components/sw/editorUtils";
import {
  isTextInputTarget,
  roundToHundredths,
  WORD_START_SHIFT_SECONDS,
  type PerspectiveRuntimeMap,
  type PerspectiveRuntimeState,
} from "@/components/sw/runtime";
import { useSwMidiControls } from "@/components/sw/useSwMidiControls";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";
import {
  buildClearAllMarkTimings,
  buildMarkAndForwardState,
  buildTimingEndEntry,
  buildTimingEntries,
  buildTimingStartEntry,
  buildUndoLastMarkState,
  getTimingEditorIndex,
} from "./timingEditor";

type PatchRuntime = (
  id: string,
  patch: Partial<PerspectiveRuntimeState>,
) => void;

type UseSwTimingEditorArgs = {
  audioRef: RefObject<HTMLAudioElement | null>;
  commitCurrentTime: (time: number, options?: { forceRender?: boolean }) => number;
  enabled: boolean;
  getCurrentTime: () => number;
  isPlaying: boolean;
  patchRuntime: PatchRuntime;
  runtimeById: PerspectiveRuntimeMap;
  selectedPerspective: Perspective | null;
  selectedTimings: WordTimingEntry[];
  selectedWordIndex?: number;
  setSelectedId: (id: string) => void;
};

export const useSwTimingEditor = ({
  audioRef,
  commitCurrentTime,
  enabled,
  getCurrentTime,
  isPlaying,
  patchRuntime,
  runtimeById,
  selectedPerspective,
  selectedTimings,
  selectedWordIndex,
  setSelectedId,
}: UseSwTimingEditorArgs) => {
  const updateTimingEntry = useCallback(
    (index: number, next: WordTimingEntry | null) => {
      if (!selectedPerspective) return;
      const perspectiveId = selectedPerspective.id;
      const runtimeState = runtimeById[perspectiveId];
      const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
      const words = getPerspectiveWords(selectedPerspective);
      const existingTimings =
        runtimeState?.timings ?? selectedPerspective.wordTimings ?? [];
      const nextTimings = buildTimingEntries({
        existingTimings,
        wordsLength: words.length,
      });
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
      updateTimingEntry(
        index,
        buildTimingStartEntry({
          existing: selectedTimings[index],
          start,
        }),
      );
    },
    [selectedTimings, updateTimingEntry],
  );

  const setTimingEnd = useCallback(
    (index: number, end: number) => {
      updateTimingEntry(
        index,
        buildTimingEndEntry({
          existing: selectedTimings[index],
          end,
        }),
      );
    },
    [selectedTimings, updateTimingEntry],
  );

  const shiftSelectedWordStart = useCallback(
    (delta: number) => {
      if (!selectedPerspective) return;
      const words = getPerspectiveWords(selectedPerspective);
      if (words.length === 0) return;
      const currentIndex = getTimingEditorIndex({
        selectedWordIndex,
        wordsLength: words.length,
      });
      if (currentIndex < 0) return;
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
      audioRef,
      commitCurrentTime,
      getCurrentTime,
      isPlaying,
      patchRuntime,
      selectedPerspective,
      selectedTimings,
      selectedWordIndex,
      setSelectedId,
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
    const nextState = buildMarkAndForwardState({
      currentTime: getCurrentTime(),
      existingTimings: selectedTimings,
      selectedWordIndex,
      wordsLength: words.length,
    });
    if (!nextState) return;
    const runtimeState = runtimeById[selectedPerspective.id];
    const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
    setSelectedId(selectedPerspective.id);
    patchRuntime(selectedPerspective.id, {
      dirtyTimings: true,
      selectedWordIndex: nextState.nextSelectedWordIndex,
      timings: nextState.nextTimings,
      timingsRevision: nextRevision,
    });
  }, [
    getCurrentTime,
    patchRuntime,
    runtimeById,
    selectedPerspective,
    selectedTimings,
    selectedWordIndex,
    setSelectedId,
  ]);

  const undoLastMark = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    const nextState = buildUndoLastMarkState({
      existingTimings: selectedTimings,
      selectedWordIndex,
      wordsLength: words.length,
    });
    if (!nextState) return;
    const runtimeState = runtimeById[selectedPerspective.id];
    const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
    setSelectedId(selectedPerspective.id);
    patchRuntime(selectedPerspective.id, {
      dirtyTimings: true,
      selectedWordIndex: nextState.nextSelectedWordIndex,
      timings: nextState.nextTimings,
      timingsRevision: nextRevision,
    });
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextState.seekTime;
    }
    commitCurrentTime(nextState.seekTime);
    if (audio && isPlaying) {
      audio.play().catch(() => {});
    }
  }, [
    audioRef,
    commitCurrentTime,
    isPlaying,
    patchRuntime,
    runtimeById,
    selectedPerspective,
    selectedTimings,
    selectedWordIndex,
    setSelectedId,
  ]);

  const rewindToPrevious = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const prevIndex = Math.max(
      0,
      getTimingEditorIndex({
        selectedWordIndex,
        wordsLength: words.length,
      }) - 1,
    );
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
    audioRef,
    commitCurrentTime,
    isPlaying,
    patchRuntime,
    selectedPerspective,
    selectedTimings,
    selectedWordIndex,
    setSelectedId,
  ]);

  const markCurrentEnd = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    setTimingEnd(currentIndex, getCurrentTime());
  }, [getCurrentTime, selectedPerspective, selectedWordIndex, setTimingEnd]);

  const clearCurrentMark = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    updateTimingEntry(currentIndex, null);
  }, [selectedPerspective, selectedWordIndex, updateTimingEntry]);

  const clearAllMarks = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const perspectiveId = selectedPerspective.id;
    const runtimeState = runtimeById[perspectiveId];
    const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
    patchRuntime(perspectiveId, {
      timings: buildClearAllMarkTimings(words.length),
      timingsRevision: nextRevision,
      dirtyTimings: true,
    });
  }, [patchRuntime, runtimeById, selectedPerspective]);

  useEffect(() => {
    if (!selectedPerspective || !enabled) return;

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
    enabled,
    clearCurrentMark,
    markAndForward,
    markCurrentEnd,
    rewindToPrevious,
    selectedPerspective,
  ]);

  useSwMidiControls({
    enabled,
    onMarkAndForward: markAndForward,
    onUndoLastMark: undoLastMark,
    onShiftSelectedWordStart: shiftSelectedWordStart,
  });

  return {
    clearAllMarks,
    clearCurrentMark,
    markAndForward,
    markCurrentEnd,
    rewindToPrevious,
    setTimingEnd,
    setTimingStart,
    shiftSelectedWordStart,
    shiftWordStartBackward,
    shiftWordStartForward,
    undoLastMark,
    updateTimingEntry,
  };
};
