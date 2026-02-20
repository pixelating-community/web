"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  coerceTimingEntry,
  getPerspectiveWords,
} from "@/components/sw/editorUtils";
import {
  DEFAULT_MIDI_UNDO_NOTE,
  isTextInputTarget,
  WORD_START_SHIFT_SECONDS,
  type PerspectiveRuntimeMap,
  type PerspectiveRuntimeState,
} from "@/components/sw/runtime";
import {
  useSwMidiControls,
  type MidiLearnTarget,
} from "@/components/sw/useSwMidiControls";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";
import {
  buildClearAllMarkTimings,
  buildMarkAndForwardState,
  buildTimingEndEntry,
  buildTimingEntries,
  buildTimingStartEntry,
  buildUndoLastMarkState,
  getTimingEditorIndex,
} from "@/components/sw/timingEditor";

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
  // Ref tracks latest timings across synchronous calls within the same frame.
  // Prevents patchRuntime calls from overwriting each other before React re-renders.
  const latestTimingsRef = useRef<(WordTimingEntry | null)[]>(selectedTimings);
  latestTimingsRef.current = selectedTimings;
  const selectedWordIndexRef = useRef(selectedWordIndex);
  selectedWordIndexRef.current = selectedWordIndex;

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

  const shiftSelectedWordStartRef = useRef(
    (_delta: number) => {},
  );
  shiftSelectedWordStartRef.current = (delta: number) => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex: selectedWordIndexRef.current,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    const existing = coerceTimingEntry(latestTimingsRef.current, currentIndex);
    const baseStart = existing ? existing.start : getCurrentTime();
    const nextStart = baseStart + delta;
    const nextEntry = buildTimingStartEntry({
      existing: latestTimingsRef.current[currentIndex],
      start: nextStart,
    });
    const nextTimings = [...latestTimingsRef.current];
    nextTimings[currentIndex] = nextEntry;
    latestTimingsRef.current = nextTimings;
    setTimingStart(currentIndex, nextStart);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextStart;
    }
    commitCurrentTime(nextStart, { forceRender: true });
  };
  const shiftSelectedWordStart = useCallback(
    (delta: number) => shiftSelectedWordStartRef.current(delta),
    [],
  );

  const shiftSelectedWordEndRef = useRef(
    (_delta: number) => {},
  );
  shiftSelectedWordEndRef.current = (delta: number) => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex: selectedWordIndexRef.current,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    const existing = coerceTimingEntry(latestTimingsRef.current, currentIndex);
    const baseStart = existing?.start ?? getCurrentTime();
    const baseEnd = existing?.end ?? baseStart;
    const nextEnd = baseEnd + delta;
    const nextEntry = buildTimingEndEntry({
      existing: latestTimingsRef.current[currentIndex],
      end: nextEnd,
    });
    const nextTimings = [...latestTimingsRef.current];
    nextTimings[currentIndex] = nextEntry;
    latestTimingsRef.current = nextTimings;
    setTimingEnd(currentIndex, nextEnd);
  };
  const shiftSelectedWordEnd = useCallback(
    (delta: number) => shiftSelectedWordEndRef.current(delta),
    [],
  );

  const setWordStartToCurrent = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    if (words.length === 0) return;
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex: selectedWordIndexRef.current,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    const time = getCurrentTime();
    setTimingStart(currentIndex, time);
    if (currentIndex > 0) {
      const prev = coerceTimingEntry(latestTimingsRef.current, currentIndex - 1);
      if (prev && prev.end !== null && prev.end > time) {
        setTimingEnd(currentIndex - 1, time);
      }
    }
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
    commitCurrentTime(time);
  }, [audioRef, commitCurrentTime, getCurrentTime, selectedPerspective, setTimingEnd, setTimingStart]);

  const shiftWordStartBackward = useCallback(() => {
    shiftSelectedWordStart(-WORD_START_SHIFT_SECONDS);
  }, [shiftSelectedWordStart]);

  const shiftWordStartForward = useCallback(() => {
    shiftSelectedWordStart(WORD_START_SHIFT_SECONDS);
  }, [shiftSelectedWordStart]);

  const markStartAtIndex = useCallback(
    (targetIndex: number) => {
      if (!selectedPerspective) return;
      const words = getPerspectiveWords(selectedPerspective);
      if (targetIndex < 0 || targetIndex >= words.length) return;
      const nextTimings = buildTimingEntries({
        existingTimings: latestTimingsRef.current,
        wordsLength: words.length,
      });
      nextTimings[targetIndex] = buildTimingStartEntry({
        existing: nextTimings[targetIndex],
        start: getCurrentTime(),
      });
      latestTimingsRef.current = nextTimings;
      const runtimeState = runtimeById[selectedPerspective.id];
      const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
      setSelectedId(selectedPerspective.id);
      patchRuntime(selectedPerspective.id, {
        dirtyTimings: true,
        selectedWordIndex: targetIndex,
        timings: nextTimings,
        timingsRevision: nextRevision,
      });
    },
    [
      getCurrentTime,
      patchRuntime,
      runtimeById,
      selectedPerspective,
      setSelectedId,
    ],
  );

  const markStart = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    markStartAtIndex(currentIndex);
  }, [markStartAtIndex, selectedPerspective, selectedWordIndex]);

  const markEndAndForward = useCallback(() => {
    if (!selectedPerspective) return;
    const words = getPerspectiveWords(selectedPerspective);
    const currentIndex = getTimingEditorIndex({
      selectedWordIndex,
      wordsLength: words.length,
    });
    if (currentIndex < 0) return;
    const nextTimings = buildTimingEntries({
      existingTimings: selectedTimings,
      wordsLength: words.length,
    });
    nextTimings[currentIndex] = buildTimingEndEntry({
      existing: nextTimings[currentIndex],
      end: getCurrentTime(),
    });
    const nextSelectedWordIndex = Math.min(words.length - 1, currentIndex + 1);
    const runtimeState = runtimeById[selectedPerspective.id];
    const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
    setSelectedId(selectedPerspective.id);
    patchRuntime(selectedPerspective.id, {
      dirtyTimings: true,
      selectedWordIndex: nextSelectedWordIndex,
      timings: nextTimings,
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

  const markEndAtIndex = useCallback(
    (targetIndex: number) => {
      if (!selectedPerspective) return;
      const perspectiveId = selectedPerspective.id;
      const words = getPerspectiveWords(selectedPerspective);
      if (targetIndex < 0 || targetIndex >= words.length) return;
      const nextTimings = buildTimingEntries({
        existingTimings: latestTimingsRef.current,
        wordsLength: words.length,
      });
      nextTimings[targetIndex] = buildTimingEndEntry({
        existing: nextTimings[targetIndex],
        end: getCurrentTime(),
      });
      latestTimingsRef.current = nextTimings;
      const runtimeState = runtimeById[perspectiveId];
      const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
      patchRuntime(perspectiveId, {
        timings: nextTimings,
        timingsRevision: nextRevision,
        dirtyTimings: true,
      });
    },
    [getCurrentTime, patchRuntime, runtimeById, selectedPerspective],
  );

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

  const [midiLearnTarget, setMidiLearnTarget] = useState<MidiLearnTarget>(null);
  const [midiUndoNote, setMidiUndoNote] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_MIDI_UNDO_NOTE;
    try {
      const stored = localStorage.getItem("sw:midi-undo-note");
      return stored ? Number(stored) : DEFAULT_MIDI_UNDO_NOTE;
    } catch {
      return DEFAULT_MIDI_UNDO_NOTE;
    }
  });

  const handleMidiLearnComplete = useCallback(
    (target: MidiLearnTarget, note: number) => {
      if (target === "undo") {
        setMidiUndoNote(note);
        try {
          localStorage.setItem("sw:midi-undo-note", String(note));
        } catch {}
      }
      setMidiLearnTarget(null);
    },
    [],
  );

  const startMidiLearn = useCallback((target: MidiLearnTarget) => {
    setMidiLearnTarget(target);
  }, []);

  const cancelMidiLearn = useCallback(() => {
    setMidiLearnTarget(null);
  }, []);

  const wordsLength = selectedPerspective
    ? getPerspectiveWords(selectedPerspective).length
    : 0;

  useSwMidiControls({
    enabled,
    learnTarget: midiLearnTarget,
    onLearnComplete: handleMidiLearnComplete,
    onMarkCurrentEnd: markCurrentEnd,
    onMarkEndAtIndex: markEndAtIndex,
    onMarkStart: markStart,
    onMarkStartAtIndex: markStartAtIndex,
    onMarkEndAndForward: markEndAndForward,
    onUndoLastMark: undoLastMark,
    onShiftSelectedWordStart: shiftSelectedWordStart,
    onShiftSelectedWordEnd: shiftSelectedWordEnd,
    selectedWordIndex,
    undoNote: midiUndoNote,
    wordsLength,
  });

  return {
    cancelMidiLearn,
    clearAllMarks,
    clearCurrentMark,
    markAndForward,
    markCurrentEnd,
    markStartAtIndex,
    midiLearnTarget,
    midiUndoNote,
    rewindToPrevious,
    setTimingEnd,
    setTimingStart,
    setWordStartToCurrent,
    shiftSelectedWordStart,
    shiftWordStartBackward,
    shiftWordStartForward,
    startMidiLearn,
    undoLastMark,
    updateTimingEntry,
  };
};
