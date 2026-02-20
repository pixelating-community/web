import { useEffect, useRef } from "react";
import {
  decodeMidiCcDelta,
  DEFAULT_MIDI_UNDO_NOTE,
  MIDI_FINE_NUDGE_CC,
  MIDI_FINE_NUDGE_STEP_SECONDS,
  type MidiAccessLike,
  type MidiInputLike,
  type MidiMessageEventLike,
  type NavigatorWithMidi,
  pickPreferredMidiInput,
} from "@/components/sw/runtime";

export type MidiLearnTarget = "undo" | null;

const HELD_WORD_SELECTOR = "[data-word-index]";
const HELD_CLASS = "is-held";
const HELD_RELEASING_CLASS = "is-held-releasing";
const HELD_DURATION_INTERVAL_MS = 100;

const findWordElement = (index: number): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    `${HELD_WORD_SELECTOR}[data-word-index="${index}"]`,
  );

const clearHeldState = (element: HTMLElement) => {
  element.classList.remove(HELD_CLASS);
  element.classList.add(HELD_RELEASING_CLASS);
  delete element.dataset.heldDuration;
  // Remove releasing class after transition completes
  const onEnd = () => {
    element.classList.remove(HELD_RELEASING_CLASS);
    element.removeEventListener("transitionend", onEnd);
  };
  element.addEventListener("transitionend", onEnd);
  // Fallback in case transitionend doesn't fire
  setTimeout(() => {
    element.classList.remove(HELD_RELEASING_CLASS);
    element.removeEventListener("transitionend", onEnd);
  }, 500);
};

type UseSwMidiControlsArgs = {
  enabled: boolean;
  learnTarget: MidiLearnTarget;
  onLearnComplete: (target: MidiLearnTarget, note: number) => void;
  onMarkCurrentEnd: () => void;
  onMarkEndAtIndex: (index: number) => void;
  onMarkStart: () => void;
  onMarkStartAtIndex: (index: number) => void;
  onMarkEndAndForward: () => void;
  onUndoLastMark: () => void;
  onShiftSelectedWordStart: (delta: number) => void;
  selectedWordIndex?: number;
  undoNote?: number;
  wordsLength: number;
};

export const useSwMidiControls = ({
  enabled,
  learnTarget,
  onLearnComplete,
  onMarkCurrentEnd,
  onMarkEndAtIndex,
  onMarkStart,
  onMarkStartAtIndex,
  onMarkEndAndForward,
  onUndoLastMark,
  onShiftSelectedWordStart,
  selectedWordIndex,
  undoNote = DEFAULT_MIDI_UNDO_NOTE,
  wordsLength,
}: UseSwMidiControlsArgs) => {
  const midiCcValueByChannelRef = useRef<Map<string, number>>(new Map());
  const wordCursorRef = useRef(0);
  const learnTargetRef = useRef(learnTarget);
  const onLearnCompleteRef = useRef(onLearnComplete);
  const onMarkCurrentEndRef = useRef(onMarkCurrentEnd);
  const onMarkEndAtIndexRef = useRef(onMarkEndAtIndex);
  const onMarkStartRef = useRef(onMarkStart);
  const onMarkStartAtIndexRef = useRef(onMarkStartAtIndex);
  const onMarkEndAndForwardRef = useRef(onMarkEndAndForward);
  const onUndoLastMarkRef = useRef(onUndoLastMark);
  const onShiftSelectedWordStartRef = useRef(onShiftSelectedWordStart);
  const undoNoteRef = useRef(undoNote);
  const wordsLengthRef = useRef(wordsLength);
  learnTargetRef.current = learnTarget;
  onLearnCompleteRef.current = onLearnComplete;
  onMarkCurrentEndRef.current = onMarkCurrentEnd;
  onMarkEndAtIndexRef.current = onMarkEndAtIndex;
  onMarkStartRef.current = onMarkStart;
  onMarkStartAtIndexRef.current = onMarkStartAtIndex;
  onMarkEndAndForwardRef.current = onMarkEndAndForward;
  onUndoLastMarkRef.current = onUndoLastMark;
  onShiftSelectedWordStartRef.current = onShiftSelectedWordStart;
  undoNoteRef.current = undoNote;
  wordsLengthRef.current = wordsLength;

  // Sync cursor only when selectedWordIndex changes externally (e.g. tapping a word),
  // but not when MIDI itself caused the change. We use a flag set during MIDI handlers.
  const midiActiveRef = useRef(false);
  const prevSelectedWordIndexRef = useRef(selectedWordIndex);
  if (selectedWordIndex !== prevSelectedWordIndexRef.current) {
    prevSelectedWordIndexRef.current = selectedWordIndex;
    if (!midiActiveRef.current && typeof selectedWordIndex === "number" && selectedWordIndex >= 0) {
      wordCursorRef.current = selectedWordIndex;
    }
  }

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined") return;
    const navigatorWithMidi = navigator as NavigatorWithMidi;
    const requestMIDIAccess = navigatorWithMidi.requestMIDIAccess;
    if (!requestMIDIAccess) return;

    let disposed = false;
    let midiAccess: MidiAccessLike | null = null;
    let activeInput: MidiInputLike | null = null;
    const heldNotes = new Set<number>();
    let heldWordIndex: number | null = null;
    let heldStartTime = 0;
    let heldTimerHandle: ReturnType<typeof setInterval> | null = null;

    const startHeldTimer = (index: number) => {
      // Clear any previous hold
      if (heldWordIndex !== null && heldWordIndex !== index) {
        const prevEl = findWordElement(heldWordIndex);
        if (prevEl) clearHeldState(prevEl);
      }
      if (heldTimerHandle !== null) clearInterval(heldTimerHandle);

      heldWordIndex = index;
      heldStartTime = performance.now();
      const el = findWordElement(index);
      if (el) {
        el.classList.remove(HELD_RELEASING_CLASS);
        el.classList.add(HELD_CLASS);
        el.dataset.heldDuration = "0.0s";
      }

      heldTimerHandle = setInterval(() => {
        const elapsed = (performance.now() - heldStartTime) / 1000;
        const wordEl = findWordElement(index);
        if (wordEl) {
          wordEl.dataset.heldDuration = `${elapsed.toFixed(1)}s`;
        }
      }, HELD_DURATION_INTERVAL_MS);
    };

    const stopHeldTimer = () => {
      if (heldTimerHandle !== null) {
        clearInterval(heldTimerHandle);
        heldTimerHandle = null;
      }
      if (heldWordIndex !== null) {
        const el = findWordElement(heldWordIndex);
        if (el) clearHeldState(el);
        heldWordIndex = null;
      }
    };

    const handleMidiMessage = (event: MidiMessageEventLike) => {
      const data = event.data;
      if (!data || data.length < 2) return;
      const status = data[0] ?? 0;
      const data1 = data[1] ?? 0;
      const data2 = data[2] ?? 0;
      const messageType = status & 0xf0;
      const channel = status & 0x0f;

      const isNoteOn = messageType === 0x90 && data2 > 0;
      const isNoteOff = messageType === 0x80 || (messageType === 0x90 && data2 === 0);

      // Learn mode: capture the next note-on and assign it
      if (isNoteOn && learnTargetRef.current) {
        onLearnCompleteRef.current(learnTargetRef.current, data1);
        return;
      }

      if (isNoteOn) {
        midiActiveRef.current = true;
        if (data1 === undoNoteRef.current) {
          stopHeldTimer();
          onUndoLastMarkRef.current();
          // Move cursor back so next press re-marks the previous word
          const wLen = wordsLengthRef.current;
          if (wLen > 0) {
            wordCursorRef.current = (wordCursorRef.current - 1 + wLen) % wLen;
          }
          midiActiveRef.current = false;
          return;
        }
        const hadNotes = heldNotes.size > 0;
        heldNotes.add(data1);
        const wLen = wordsLengthRef.current;
        if (wLen > 0) {
          if (hadNotes) {
            // Legato: end current word, advance cursor
            onMarkEndAtIndexRef.current(wordCursorRef.current % wLen);
            wordCursorRef.current = (wordCursorRef.current + 1) % wLen;
          }
          const index = wordCursorRef.current % wLen;
          onMarkStartAtIndexRef.current(index);
          startHeldTimer(index);
        } else {
          if (hadNotes) {
            onMarkCurrentEndRef.current();
          }
          onMarkStartRef.current();
        }
        return;
      }

      if (isNoteOff && data1 !== undoNoteRef.current) {
        heldNotes.delete(data1);
        if (heldNotes.size === 0) {
          midiActiveRef.current = false;
          const wLen = wordsLengthRef.current;
          if (wLen > 0) {
            onMarkEndAtIndexRef.current(wordCursorRef.current % wLen);
          } else {
            onMarkCurrentEndRef.current();
          }
          stopHeldTimer();
          // Advance cursor so next press starts on next word
          if (wLen > 0) {
            wordCursorRef.current = (wordCursorRef.current + 1) % wLen;
          }
        }
        return;
      }

      if (messageType !== 0xb0 || data1 !== MIDI_FINE_NUDGE_CC) return;
      const key = `${channel}:${data1}`;
      const previousValue = midiCcValueByChannelRef.current.get(key);
      midiCcValueByChannelRef.current.set(key, data2);
      if (typeof previousValue !== "number") return;
      const delta = decodeMidiCcDelta(previousValue, data2);
      if (!delta) return;

      // Ignore abrupt jumps from absolute knob pickup.
      if (Math.abs(delta) > 32) return;
      onShiftSelectedWordStartRef.current(delta * MIDI_FINE_NUDGE_STEP_SECONDS);
    };

    const detachInput = () => {
      if (!activeInput) return;
      activeInput.onmidimessage = null;
      activeInput = null;
    };

    const syncActiveInput = () => {
      if (!midiAccess) return;
      const inputs = Array.from(midiAccess.inputs.values());
      const preferredInput = pickPreferredMidiInput(inputs);
      const nextInput =
        preferredInput ??
        inputs.find((input) => input.state !== "disconnected") ??
        null;
      if (
        activeInput &&
        nextInput &&
        activeInput.id &&
        nextInput.id &&
        activeInput.id === nextInput.id
      ) {
        return;
      }
      detachInput();
      midiCcValueByChannelRef.current.clear();
      if (!nextInput) return;
      activeInput = nextInput;
      activeInput.onmidimessage = handleMidiMessage;
    };

    requestMIDIAccess
      .call(navigatorWithMidi, { sysex: false })
      .then((access) => {
        if (disposed) return;
        midiAccess = access;
        syncActiveInput();
        midiAccess.onstatechange = () => {
          if (disposed) return;
          syncActiveInput();
        };
      })
      .catch(() => {});

    return () => {
      disposed = true;
      stopHeldTimer();
      detachInput();
      midiCcValueByChannelRef.current.clear();
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
    };
  }, [enabled]);
};
