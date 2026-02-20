import { useEffect, useRef } from "react";
import {
  decodeMidiCcDelta,
  MIDI_FINE_NUDGE_CC,
  MIDI_FINE_NUDGE_STEP_SECONDS,
  MIDI_MARK_NOTES,
  MIDI_UNDO_NOTES,
  type MidiAccessLike,
  type MidiInputLike,
  type MidiMessageEventLike,
  type NavigatorWithMidi,
  pickPreferredMidiInput,
} from "@/components/sw/runtime";

type UseSwMidiControlsArgs = {
  enabled: boolean;
  onMarkAndForward: () => void;
  onUndoLastMark: () => void;
  onShiftSelectedWordStart: (delta: number) => void;
};

export const useSwMidiControls = ({
  enabled,
  onMarkAndForward,
  onUndoLastMark,
  onShiftSelectedWordStart,
}: UseSwMidiControlsArgs) => {
  const midiCcValueByChannelRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined") return;
    const navigatorWithMidi = navigator as NavigatorWithMidi;
    const requestMIDIAccess = navigatorWithMidi.requestMIDIAccess;
    if (!requestMIDIAccess) return;

    let disposed = false;
    let midiAccess: MidiAccessLike | null = null;
    let activeInput: MidiInputLike | null = null;

    const handleMidiMessage = (event: MidiMessageEventLike) => {
      const data = event.data;
      if (!data || data.length < 2) return;
      const status = data[0] ?? 0;
      const data1 = data[1] ?? 0;
      const data2 = data[2] ?? 0;
      const messageType = status & 0xf0;
      const channel = status & 0x0f;

      if (messageType === 0x90 && data2 > 0) {
        if (MIDI_MARK_NOTES.has(data1)) {
          onMarkAndForward();
          return;
        }
        if (MIDI_UNDO_NOTES.has(data1)) {
          onUndoLastMark();
          return;
        }
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
      onShiftSelectedWordStart(delta * MIDI_FINE_NUDGE_STEP_SECONDS);
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
      detachInput();
      midiCcValueByChannelRef.current.clear();
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
    };
  }, [enabled, onMarkAndForward, onShiftSelectedWordStart, onUndoLastMark]);
};
