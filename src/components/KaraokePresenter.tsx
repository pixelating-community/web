"use client";

import type { CSSProperties, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getKaraokeLines } from "@/lib/karaokeLines";
import { findActiveWordIndex, getTimingDuration, coerceTiming } from "@/lib/swPlayback";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

type KaraokePresenterProps = {
  perspective: Perspective;
  timings: WordTimingEntry[];
  audioRef: RefObject<HTMLMediaElement | null>;
  currentTime: number;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  activePhraseRange?: {
    endIndex: number;
    startIndex: number;
  } | null;
  selectedWordIndex?: number | null;
  wordStyles?: Record<number, {
    classes?: string[];
    gradientStart?: string;
    gradientEnd?: string;
    inlineStyle?: CSSProperties;
  }>;
  onSelectWord?: (index: number, time?: number) => void;
  onDoubleSelectWord?: (index: number, time?: number) => void;
};

export const KaraokePresenter = ({
  perspective,
  timings,
  audioRef,
  isPlaying,
  onTogglePlayback,
  activePhraseRange,
  selectedWordIndex,
  wordStyles,
  onSelectWord,
  onDoubleSelectWord,
}: KaraokePresenterProps) => {
  const wordRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevActiveRef = useRef(-1);
  const didInitialScrollRef = useRef(false);
  const scrolledToLineRef = useRef(0);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);

  const { lines, wordToLine, wordIndexByLine, activeTimings, lineEndTimes } = useMemo(() => {
    const sourceLines = getKaraokeLines(perspective);
    const maxWordIndex = Math.max(
      -1,
      ...sourceLines.flatMap((line) => line.map((word) => word.index)),
    );

    const timedPerLine = Array.from<number>({ length: sourceLines.length }).fill(0);
    for (let lineIndex = 0; lineIndex < sourceLines.length; lineIndex += 1) {
      for (const word of sourceLines[lineIndex] ?? []) {
        if (coerceTiming(timings, word.index)) timedPerLine[lineIndex] += 1;
      }
    }
    const lineIsTranscribed = sourceLines.map((line, i) => {
      const timed = timedPerLine[i] ?? 0;
      return timed >= 2 || (timed > 0 && timed === line.length);
    });

    const rawToNew: (number | null)[] = sourceLines.map(() => null);
    const lines: typeof sourceLines = [];
    for (let rawIdx = 0; rawIdx < sourceLines.length; rawIdx++) {
      if (!lineIsTranscribed[rawIdx]) continue;
      rawToNew[rawIdx] = lines.length;
      lines.push(sourceLines[rawIdx] ?? []);
    }

    const wordToLine: number[] = Array.from<number>({ length: maxWordIndex + 1 }).fill(-1);
    const wordIndexByLine: number[][] = lines.map(() => []);
    for (let rawLineIndex = 0; rawLineIndex < sourceLines.length; rawLineIndex += 1) {
      const newIdx = rawToNew[rawLineIndex];
      if (newIdx === null || newIdx === undefined) continue;
      for (const word of sourceLines[rawLineIndex] ?? []) {
        wordToLine[word.index] = newIdx;
        wordIndexByLine[newIdx]?.push(word.index);
      }
    }

    const activeTimings: WordTimingEntry[] = timings.slice();
    for (let rawLineIndex = 0; rawLineIndex < sourceLines.length; rawLineIndex += 1) {
      if (lineIsTranscribed[rawLineIndex]) continue;
      for (const word of sourceLines[rawLineIndex] ?? []) {
        activeTimings[word.index] = null;
      }
    }

    const lineEndTimes = wordIndexByLine.map((wordIndices) => {
      const lastOrigIdx = wordIndices[wordIndices.length - 1];
      const timing = coerceTiming(timings, lastOrigIdx);
      return timing?.end ?? Number.POSITIVE_INFINITY;
    });

    return { lines, wordToLine, wordIndexByLine, activeTimings, lineEndTimes };
  }, [perspective, timings]);

  useEffect(() => {
    const scrollToLine = (idx: number, behavior: ScrollBehavior) => {
      const el = lineRefs.current[idx];
      if (!el) return;
      el.scrollIntoView({ behavior, block: "nearest", inline: "center" });
      scrolledToLineRef.current = idx;
    };

    let rafId = 0;
    let lastLineIdx = -2;

    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        const time = audio.currentTime;
        const idx = findActiveWordIndex(activeTimings, time);
        const prev = prevActiveRef.current;

        if (prev !== idx && prev >= 0) {
          const prevEl = wordRefs.current[prev];
          if (prevEl) {
            prevEl.classList.remove("is-playback");
            prevEl.style.removeProperty("--sw-progress");
          }
        }

        if (idx >= 0) {
          const el = wordRefs.current[idx];
          if (el) {
            el.classList.add("is-playback");
            const timing = coerceTiming(timings, idx);
            if (timing) {
              const duration = getTimingDuration(timings, idx);
              const elapsed = time - timing.start;
              const progress =
                duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 1;
              el.style.setProperty("--sw-progress", String(progress));
            }
          }
        }

        prevActiveRef.current = idx;

        let activeLine = -1;
        for (let i = 0; i < lineEndTimes.length; i++) {
          if (lineEndTimes[i] > time) {
            activeLine = i;
            break;
          }
        }

        if (activeLine !== lastLineIdx) {
          lastLineIdx = activeLine;
          setActiveLineIndex(activeLine);

          if (!didInitialScrollRef.current) {
            scrollToLine(activeLine < 0 ? 0 : activeLine, "auto");
            didInitialScrollRef.current = true;
          } else if (
            activeLine >= 0 &&
            Math.abs(activeLine - scrolledToLineRef.current) > 1
          ) {
            scrollToLine(activeLine, "smooth");
          }
        }

        if (idx >= 0) {
          const lineOfIdx = wordToLine[idx] ?? -1;
          if (lineOfIdx >= 0) {
            const wordsInLine = wordIndexByLine[lineOfIdx];
            if (wordsInLine && wordsInLine[wordsInLine.length - 1] === idx) {
              const nextIdx = lineOfIdx + 1;
              if (lineRefs.current[nextIdx] && scrolledToLineRef.current !== nextIdx) {
                scrollToLine(nextIdx, "smooth");
              }
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [activeTimings, timings, wordToLine, wordIndexByLine, lineEndTimes, audioRef]);

  const handleWordClick = useCallback(
    (index: number) => {
      const timing = timings[index];
      onSelectWord?.(index, timing?.start);
      if (!timing) return;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = timing.start;
      }
    },
    [audioRef, onSelectWord, timings],
  );

  const handleWordDoubleClick = useCallback(
    (index: number) => {
      const timing = timings[index];
      onDoubleSelectWord?.(index, timing?.start);
      if (!timing) return;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = timing.start;
      }
    },
    [audioRef, onDoubleSelectWord, timings],
  );

  return (
    <div className="karaoke-view flex h-full w-full flex-col">
      <div className="shrink-0 p-4">
        <button
          type="button"
          onClick={onTogglePlayback}
          aria-label={isPlaying ? "Pause" : "Play"}
          className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 text-lg leading-none transition ${
            isPlaying ? "text-teal-100 text-[1rem]" : "text-(--color-neon-teal-light) text-[1.2rem]"
          }`}
        >
          {isPlaying ? "■" : "▶"}
        </button>
      </div>
      <div className="karaoke-lines sw-perspective-text relative flex-1 overflow-x-auto overflow-y-hidden scrollbar-transparent flex items-center px-[50vw]">
        {lines.map((lineWords, lineIndex) => {
          const state =
            lineIndex === activeLineIndex
              ? "is-active"
              : lineIndex < activeLineIndex
                ? "is-past"
                : "is-future";
          return (
            <div
              key={lineIndex}
              ref={(el) => { lineRefs.current[lineIndex] = el; }}
              className={`karaoke-line flex flex-wrap shrink-0 items-center justify-center max-w-[90vw] px-[4vw] ${state}`}
            >
              {lineWords.map((lineWord) => {
                const index = lineWord.index;
                const timing = index >= 0 ? timings[index] : undefined;
                const hasTiming = Boolean(timing);
                const wordStyle = index >= 0 ? wordStyles?.[index] : undefined;
                const isSelected = selectedWordIndex === index;
                const isActivePhraseWord = Boolean(
                  activePhraseRange &&
                    index >= activePhraseRange.startIndex &&
                    index <= activePhraseRange.endIndex,
                );
                const styleVars = wordStyle
                  ? ({
                      "--color-gradient-start": wordStyle.gradientStart,
                      "--color-gradient-end": wordStyle.gradientEnd,
                    } as CSSProperties)
                  : undefined;
                return (
                  <button
                    key={`${lineIndex}:${lineWord.index}`}
                    type="button"
                    ref={(el) => {
                      if (index >= 0) wordRefs.current[index] = el;
                    }}
                    onClick={() => index >= 0 && handleWordClick(index)}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (index >= 0) handleWordDoubleClick(index);
                    }}
                    aria-pressed={isSelected || isActivePhraseWord}
                    style={styleVars}
                    className={`sw-word karaoke-word relative px-2 font-bold leading-none text-center border-0 bg-transparent cursor-pointer transition-opacity duration-200 ${
                      hasTiming ? "" : "opacity-40"
                    } ${isActivePhraseWord ? "is-active-phrase" : ""} ${
                      isSelected ? "is-selected ring-2 ring-purple-200/90" : ""
                    } ${wordStyle ? "in-phrase" : ""} ${
                      isSelected ? "z-10" : ""
                    }`}
                  >
                    <span className="sw-bg" aria-hidden="true" />
                    <span
                      className={`sw-text ${wordStyle?.classes?.join(" ") ?? ""}`}
                      style={wordStyle?.inlineStyle}
                    >
                      {lineWord.word}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
