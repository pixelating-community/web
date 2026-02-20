"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LineLengthIndicator } from "@/components/LineLengthIndicator";
import { SWEditor } from "@/components/SWEditor";
import {
  findPhraseForWord,
  getPhraseBounds,
  nextColorIndex,
  PHRASE_GRADIENTS,
  sanitizeWordClasses,
  type Phrase,
} from "@/lib/karaokePhrases";
import type {
  MidiAccessLike,
  MidiInputLike,
  MidiMessageEventLike,
  NavigatorWithMidi,
} from "@/components/sw/runtime";
import { pickPreferredMidiInput } from "@/components/sw/runtime";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

type KaraokeSamplerProps = {
  perspective: Perspective;
  timings: WordTimingEntry[];
  audioRef: RefObject<HTMLMediaElement | null>;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlayback: () => void;
  activePhrase: Phrase | null;
  onActivatePhrase: (phrase: Phrase | null) => void;
  editable?: boolean;
};

const WORD_SELECTOR = "[data-word-index]";
const PHRASE_CLASSES_ATTR = "data-phrase-classes";

const applyPhraseStyles = (
  container: HTMLElement,
  phrases: Phrase[],
) => {
  const wordElements = container.querySelectorAll<HTMLElement>(WORD_SELECTOR);
  for (const el of wordElements) {
    const idx = Number.parseInt(el.dataset.wordIndex ?? "", 10);
    if (Number.isNaN(idx)) continue;

    // Remove previously applied phrase classes
    const prev = el.getAttribute(PHRASE_CLASSES_ATTR);
    if (prev) {
      el.classList.remove(...prev.split(" "));
      el.removeAttribute(PHRASE_CLASSES_ATTR);
    }

    const phrase = findPhraseForWord(phrases, idx);
    if (phrase) {
      const gradient = PHRASE_GRADIENTS[phrase.colorIndex % PHRASE_GRADIENTS.length];
      el.style.setProperty("--color-gradient-start", gradient.start);
      el.style.setProperty("--color-gradient-end", gradient.end);
      el.classList.add("in-phrase");

      // Apply allowlisted classes from phrase
      if (phrase.classes && phrase.classes.length > 0) {
        el.classList.add(...phrase.classes);
        el.setAttribute(PHRASE_CLASSES_ATTR, phrase.classes.join(" "));
      }
    } else {
      el.style.removeProperty("--color-gradient-start");
      el.style.removeProperty("--color-gradient-end");
      el.classList.remove("in-phrase");
    }
  }
};

export const KaraokeSampler = ({
  perspective,
  timings,
  audioRef,
  currentTime,
  isPlaying,
  onSeek,
  onTogglePlayback,
  activePhrase,
  onActivatePhrase,
  editable = false,
}: KaraokeSamplerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;

  // Apply phrase colors whenever phrases change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Small delay to let SWEditor render
    const frame = requestAnimationFrame(() => {
      applyPhraseStyles(container, phrases);
    });
    return () => cancelAnimationFrame(frame);
  }, [phrases, perspective.id]);

  // Also reapply after SWEditor renders (observe DOM mutations)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => {
      applyPhraseStyles(container, phrasesRef.current);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const handleSelectWord = useCallback(
    (index: number) => {
      if (!editable) return;
      if (selectionStart === null) {
        // First tap: start phrase selection
        setSelectionStart(index);
        return;
      }

      // Second tap: complete phrase
      const start = Math.min(selectionStart, index);
      const end = Math.max(selectionStart, index);
      setSelectionStart(null);

      // Check if tapping inside an existing phrase — activate it for looping
      const existing = findPhraseForWord(phrasesRef.current, index);
      if (existing && selectionStart === index) {
        onActivatePhrase(activePhrase === existing ? null : existing);
        // Seek to phrase start
        const bounds = getPhraseBounds(timings, existing);
        if (bounds) onSeek(bounds.start);
        return;
      }

      // Create new phrase
      const newPhrase: Phrase = {
        startIndex: start,
        endIndex: end,
        colorIndex: nextColorIndex(phrasesRef.current),
      };
      setPhrases((prev) => [...prev, newPhrase]);
    },
    [editable, selectionStart, activePhrase, onActivatePhrase, onSeek, timings],
  );

  // MIDI drum pad → phrase triggering (editor only)
  useEffect(() => {
    if (!editable) return;
    if (typeof navigator === "undefined") return;
    const nav = navigator as NavigatorWithMidi;

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
      const isNoteOn = messageType === 0x90 && data2 > 0;

      if (!isNoteOn) return;

      const currentPhrases = phrasesRef.current;
      // Find phrase mapped to this note
      const mapped = currentPhrases.find((p) => p.midiNote === data1);
      if (mapped) {
        onActivatePhrase(mapped);
        const bounds = getPhraseBounds(timings, mapped);
        if (bounds) onSeek(bounds.start);
        return;
      }

      // Auto-assign: find first unmapped phrase
      const unmapped = currentPhrases.find((p) => p.midiNote === undefined);
      if (unmapped) {
        setPhrases((prev) =>
          prev.map((p) =>
            p === unmapped ? { ...p, midiNote: data1 } : p,
          ),
        );
        onActivatePhrase(unmapped);
        const bounds = getPhraseBounds(timings, unmapped);
        if (bounds) onSeek(bounds.start);
      }
    };

    const bindInput = (input: MidiInputLike) => {
      if (activeInput) {
        activeInput.onmidimessage = null;
      }
      activeInput = input;
      input.onmidimessage = handleMidiMessage;
    };

    const requestMIDIAccess = nav.requestMIDIAccess;
    if (!requestMIDIAccess) return;

    void requestMIDIAccess
      .call(nav, { sysex: false })
      .then((access) => {
        if (disposed) return;
        midiAccess = access;
        const inputs = Array.from(access.inputs.values());
        const preferred = pickPreferredMidiInput(inputs);
        if (preferred) bindInput(preferred);
        access.onstatechange = () => {
          if (disposed || !midiAccess) return;
          const allInputs = Array.from(midiAccess.inputs.values());
          const pref = pickPreferredMidiInput(allInputs);
          if (pref && pref !== activeInput) bindInput(pref);
        };
      })
      .catch(() => {});

    return () => {
      disposed = true;
      if (activeInput) {
        activeInput.onmidimessage = null;
      }
      if (midiAccess) {
        midiAccess.onstatechange = null;
      }
    };
  }, [editable, onActivatePhrase, onSeek, timings]);

  const [styleInput, setStyleInput] = useState("");

  const handleStyleSubmit = useCallback(() => {
    if (!activePhrase) return;
    const validated = sanitizeWordClasses(styleInput);
    setPhrases((prev) =>
      prev.map((p) =>
        p === activePhrase ? { ...p, classes: validated.length > 0 ? validated : undefined } : p,
      ),
    );
    setStyleInput("");
  }, [activePhrase, styleInput]);

  const handleRemovePhrase = useCallback(() => {
    if (!activePhrase) return;
    setPhrases((prev) => prev.filter((p) => p !== activePhrase));
    onActivatePhrase(null);
  }, [activePhrase, onActivatePhrase]);

  const leadingControl = (
    <div className="inline-flex gap-2 items-center">
      <button
        type="button"
        onClick={onTogglePlayback}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-[10px] border-0 bg-transparent p-0 text-lg leading-none transition ${
          isPlaying ? "text-teal-200 text-[1rem]" : "text-(--color-neon-teal) text-[1.2rem]"
        }`}
      >
        {isPlaying ? "■" : "▶"}
      </button>
      <LineLengthIndicator text={perspective.perspective} />
      {selectionStart !== null && (
        <span className="inline-flex items-center text-xs text-white/50">
          select end word...
        </span>
      )}
      {activePhrase && selectionStart === null && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleStyleSubmit(); }}
          className="inline-flex items-center gap-1"
        >
          <input
            type="text"
            value={styleInput}
            onChange={(e) => setStyleInput(e.target.value)}
            placeholder="text-4xl font-bold..."
            className="h-8 w-40 rounded border border-white/20 bg-white/5 px-2 text-xs text-white outline-none placeholder:text-white/30"
            aria-label="Phrase style classes"
          />
          <button
            type="submit"
            className="inline-flex h-8 items-center rounded border-0 bg-white/10 px-2 text-xs text-white/80 hover:text-white touch-manipulation"
          >
            🎨
          </button>
          <button
            type="button"
            onClick={handleRemovePhrase}
            className="inline-flex h-8 items-center rounded border-0 bg-white/10 px-2 text-xs text-white/80 hover:text-white touch-manipulation"
            aria-label="Remove phrase"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="karaoke-view w-full h-full">
      <SWEditor
        perspective={perspective}
        timings={timings}
        audioRef={audioRef as RefObject<HTMLAudioElement | null>}
        currentTime={currentTime}
        isPlaying={isPlaying}
        enablePlaybackSync
        isActive
        readOnly
        showTimingLabels={false}
        onSelectWord={handleSelectWord}
        selectedWordIndex={selectionStart}
        leadingControl={leadingControl}
      />
    </div>
  );
};
