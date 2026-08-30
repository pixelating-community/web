"use client";

import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform } from "@/components/AudioWaveform";
import { PerspectiveBackground } from "@/components/PerspectiveBackground";
import {
  coerceTimingEntry,
  getPerspectiveWords,
} from "@/components/sw/editorUtils";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";
import { setTimestampSearchParams } from "@/lib/routeSearch";
import { getTimingDuration as getPlaybackTimingDuration } from "@/lib/swPlayback";
import {
  buildTopicKaraokeEditorPath,
  buildTopicKaraokePath,
  buildTopicPath,
  buildTopicPerspectivePath,
  buildTopicViewerPerspectivePath,
} from "@/lib/topicRoutes";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

type EditableTiming = {
  end?: number;
  start: number;
};

type EditableTimingEntry = EditableTiming | null;

type TimingEditorSurfaceProps = {
  canWrite?: boolean;
  perspective?: Perspective;
  topicName?: string;
  urlEndTime?: number;
  urlStartTime?: number;
};

const DEFAULT_WORD_DURATION = 0.32;
const MIN_WORD_DURATION = 0.08;
const WORD_STEP_SECONDS = 0.05;
const PLAYBACK_TICK_SECONDS = 0.045;
const PLAYBACK_RATES = [0.1, 0.25, 0.5, 1] as const;
const NAV_ITEMS = {
  karaoke: { icon: "🎤", label: "Karaoke" },
  karaokeEdit: { icon: "🎛", label: "Karaoke edit" },
  listen: { icon: "👂", label: "Listen" },
  record: { icon: "⏺", label: "Record" },
  topic: { icon: "👾", label: "Back to topic" },
} as const;

const DEMO_WORDS =
  "hold the color close until the small screen starts breathing with the song again".split(
    " ",
  );

const DEMO_TIMINGS: EditableTimingEntry[] = DEMO_WORDS.map((_, index) => ({
  end: 12.8 + index * 0.42,
  start: 12.48 + index * 0.42,
}));

const clampTime = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatTime = (value: number) => {
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
};

const normalizeTimingEntry = (
  timings: WordTimingEntry[] | undefined,
  index: number,
): EditableTimingEntry => {
  const timing = coerceTimingEntry(timings ?? [], index);
  if (!timing) return null;
  return timing.end === null
    ? { start: timing.start }
    : { end: timing.end, start: timing.start };
};

const getFirstTimingStart = (timings: EditableTimingEntry[]) => {
  for (const timing of timings) {
    if (!timing) continue;
    return timing.start;
  }
  return null;
};

const getLastTimingEnd = (timings: EditableTimingEntry[]) => {
  for (let index = timings.length - 1; index >= 0; index -= 1) {
    const timing = timings[index];
    if (!timing) continue;
    return timing.end ?? timing.start + DEFAULT_WORD_DURATION;
  }
  return null;
};

const getTimingDuration = (
  timings: EditableTimingEntry[],
  index: number | null,
) => {
  if (index === null) return DEFAULT_WORD_DURATION;
  const duration = getPlaybackTimingDuration(
    timings as WordTimingEntry[],
    index,
  );
  return duration > 0
    ? Math.max(MIN_WORD_DURATION, duration)
    : DEFAULT_WORD_DURATION;
};

const getActiveWordIndex = (
  timings: EditableTimingEntry[],
  currentTime: number,
) => {
  for (let index = 0; index < timings.length; index += 1) {
    const timing = timings[index];
    if (!timing) continue;
    const end = timing.end ?? timing.start + getTimingDuration(timings, index);
    if (currentTime >= timing.start && currentTime < end) {
      return index;
    }
  }
  return -1;
};

const resolveAudioSrc = (perspective?: Perspective) =>
  resolvePublicAudioSrc(
    perspective?.recording_src ??
      perspective?.audio_src ??
      perspective?.remix_audio_src ??
      "",
  );

const buildTimedHref = ({
  end,
  href,
  start,
}: {
  end?: number;
  href: string;
  start?: number;
}) => {
  const params = new URLSearchParams();
  setTimestampSearchParams({ end, params, start });
  const search = params.toString();
  return search ? `${href}?${search}` : href;
};

const buildInitialState = ({
  perspective,
  urlEndTime,
  urlStartTime,
}: TimingEditorSurfaceProps) => {
  const words = perspective ? getPerspectiveWords(perspective) : DEMO_WORDS;
  const timings = perspective
    ? Array.from({ length: words.length }, (_, index) =>
        normalizeTimingEntry(perspective.wordTimings, index),
      )
    : DEMO_TIMINGS;
  const firstTimingStart = getFirstTimingStart(timings);
  const lastTimingEnd = getLastTimingEnd(timings);
  const sampleStart =
    urlStartTime ?? perspective?.start_time ?? firstTimingStart ?? 12.48;
  const sampleEndCandidate =
    urlEndTime ??
    perspective?.end_time ??
    lastTimingEnd ??
    sampleStart + Math.max(5, words.length * DEFAULT_WORD_DURATION);
  const sampleEnd = Math.max(sampleStart + 0.25, sampleEndCandidate);

  return {
    currentTime: clampTime(urlStartTime ?? sampleStart, sampleStart, sampleEnd),
    sampleEnd,
    sampleStart,
    timings,
    words,
  };
};

export function TimingEditorSurface({
  canWrite = false,
  perspective,
  topicName,
  urlEndTime,
  urlStartTime,
}: TimingEditorSurfaceProps) {
  const sourceKey = `${perspective?.id ?? "demo"}:${urlStartTime ?? ""}:${
    urlEndTime ?? ""
  }`;
  const initialState = useMemo(
    () => buildInitialState({ perspective, urlEndTime, urlStartTime }),
    [perspective, urlEndTime, urlStartTime],
  );
  const [words, setWords] = useState(initialState.words);
  const [timings, setTimings] = useState(initialState.timings);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [playbackRate, setPlaybackRate] =
    useState<(typeof PLAYBACK_RATES)[number]>(0.25);
  const [previewEndTime, setPreviewEndTime] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(initialState.currentTime);
  const [sampleStart, setSampleStart] = useState(initialState.sampleStart);
  const [sampleEnd, setSampleEnd] = useState(initialState.sampleEnd);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSrc = useMemo(() => resolveAudioSrc(perspective), [perspective]);
  const waveform = perspective?.remix_waveform;
  const hasProductionNav = Boolean(topicName?.trim() && perspective?.id);
  const navigationLinks = useMemo(() => {
    const trimmedTopicName = topicName?.trim();
    const perspectiveId = perspective?.id;
    if (!trimmedTopicName || !perspectiveId) return [];

    const withBounds = (href: string) =>
      buildTimedHref({
        end: urlEndTime,
        href,
        start: urlStartTime,
      });

    return [
      {
        href: withBounds(buildTopicPerspectivePath({
          perspectiveId,
          topicName: trimmedTopicName,
        })),
        ...NAV_ITEMS.record,
      },
      {
        href: withBounds(buildTopicViewerPerspectivePath({
          perspectiveId,
          topicName: trimmedTopicName,
        })),
        ...NAV_ITEMS.listen,
      },
      {
        href: withBounds(buildTopicKaraokePath({
          perspectiveId,
          topicName: trimmedTopicName,
        })),
        ...NAV_ITEMS.karaoke,
      },
      ...(canWrite
        ? [
            {
              href: withBounds(buildTopicKaraokeEditorPath({
                perspectiveId,
                topicName: trimmedTopicName,
              })),
              ...NAV_ITEMS.karaokeEdit,
            },
          ]
        : []),
    ];
  }, [canWrite, perspective?.id, topicName, urlEndTime, urlStartTime]);
  const topicHref = topicName?.trim()
    ? buildTopicPath(topicName)
    : "/timing-editor";
  const activeWordIndex = useMemo(
    () => getActiveWordIndex(timings, currentTime),
    [currentTime, timings],
  );
  const hasSelectedWord = selectedIndex !== null;
  const selectedTiming =
    selectedIndex === null ? null : (timings[selectedIndex] ?? null);
  const selectedStart = selectedTiming?.start ?? currentTime;
  const selectedDuration = getTimingDuration(timings, selectedIndex);
  const selectedEnd = Math.min(sampleEnd, selectedStart + selectedDuration);
  const sampleRange = Math.max(0.1, sampleEnd - sampleStart);
  const playbackEnd = previewEndTime ?? sampleEnd;
  const playheadPercent = clampTime(
    ((currentTime - sampleStart) / sampleRange) * 100,
    0,
    100,
  );
  const selectedLeftPercent = clampTime(
    ((selectedStart - sampleStart) / sampleRange) * 100,
    0,
    100,
  );
  const selectedWidthPercent = clampTime(
    (selectedDuration / sampleRange) * 100,
    1,
    100 - selectedLeftPercent,
  );

  useEffect(() => {
    setWords(initialState.words);
    setTimings(initialState.timings);
    setSelectedIndex(null);
    setIsPlaying(false);
    setIsMarking(false);
    setPreviewEndTime(null);
    setCurrentTime(initialState.currentTime);
    setSampleStart(initialState.sampleStart);
    setSampleEnd(initialState.sampleEnd);
  }, [initialState, sourceKey]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (audioSrc && audio) {
        const nextTime = audio.currentTime;
        setCurrentTime(nextTime >= playbackEnd ? playbackEnd : nextTime);
        return;
      }
      setCurrentTime((previous) => {
        const next = previous + PLAYBACK_TICK_SECONDS * playbackRate;
        return next >= playbackEnd ? playbackEnd : next;
      });
    }, 45);
    return () => window.clearInterval(timer);
  }, [audioSrc, isPlaying, playbackEnd, playbackRate]);

  useEffect(() => {
    if (currentTime < playbackEnd - 0.005) return;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setIsPlaying(false);
    setPreviewEndTime(null);
  }, [currentTime, playbackEnd]);

  const selectWord = (index: number) => {
    setSelectedIndex(index);
    const nextTime = timings[index]?.start;
    if (typeof nextTime === "number") {
      setCurrentTime(nextTime);
      const audio = audioRef.current;
      if (audio && Number.isFinite(nextTime)) {
        audio.currentTime = nextTime;
      }
    }
  };

  const updateSelectedTiming = (
    getNextTiming: (timing: EditableTimingEntry) => EditableTiming,
  ) => {
    if (selectedIndex === null) return;
    setTimings((previous) =>
      previous.map((timing, index) =>
        index === selectedIndex ? getNextTiming(timing) : timing,
      ),
    );
  };

  const setSelectedStart = (start: number) => {
    if (!hasSelectedWord) return;
    updateSelectedTiming(() => {
      const duration = getTimingDuration(timings, selectedIndex);
      const nextStart = clampTime(
        start,
        sampleStart,
        sampleEnd - MIN_WORD_DURATION,
      );
      return {
        end: Math.min(sampleEnd, nextStart + duration),
        start: nextStart,
      };
    });
    setCurrentTime(clampTime(start, sampleStart, sampleEnd));
  };

  const setSelectedDuration = (duration: number) => {
    if (!hasSelectedWord) return;
    updateSelectedTiming((timing) => {
      const start = timing?.start ?? selectedStart;
      const nextDuration = clampTime(
        duration,
        MIN_WORD_DURATION,
        sampleEnd - start,
      );
      return {
        end: start + nextDuration,
        start,
      };
    });
  };

  const markStart = () => {
    if (!hasSelectedWord) return;
    setIsMarking(true);
    updateSelectedTiming((timing) => ({
      end: Math.min(
        sampleEnd,
        Math.max(currentTime + 0.18, timing?.end ?? currentTime + 0.3),
      ),
      start: currentTime,
    }));
  };

  const markEnd = () => {
    if (!hasSelectedWord || selectedIndex === null) return;
    setIsMarking(false);
    updateSelectedTiming((timing) => {
      const start = timing?.start ?? selectedStart;
      return {
        end: clampTime(currentTime, start + MIN_WORD_DURATION, sampleEnd),
        start,
      };
    });
    setSelectedIndex((previous) =>
      previous === null ? null : Math.min(words.length - 1, previous + 1),
    );
  };

  const nudgeSelected = (delta: number) => {
    setSelectedStart(selectedStart + delta);
  };

  const previewRange = (start: number, end: number) => {
    const safeStart = clampTime(start, sampleStart, sampleEnd);
    const safeEnd = clampTime(end, safeStart + MIN_WORD_DURATION, sampleEnd);
    setCurrentTime(safeStart);
    setPreviewEndTime(safeEnd);
    setIsPlaying(true);

    const audio = audioRef.current;
    if (!audioSrc || !audio) return;
    audio.pause();
    audio.playbackRate = playbackRate;
    audio.currentTime = safeStart;
    void audio.play().catch(() => {
      setIsPlaying(false);
    });
  };

  const previewSelectedWord = () => {
    if (!hasSelectedWord) return;
    previewRange(selectedStart, selectedEnd);
  };

  const previewSample = () => {
    previewRange(sampleStart, sampleEnd);
  };

  const togglePlay = () => {
    if (isPlaying) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
      setPreviewEndTime(null);
      return;
    }
    const start =
      currentTime >= sampleEnd - MIN_WORD_DURATION ? sampleStart : currentTime;
    previewRange(start, sampleEnd);
  };

  const setBound = (field: "start" | "end") => {
    if (field === "start") {
      setSampleStart(Math.min(currentTime, sampleEnd - 0.25));
      return;
    }
    setSampleEnd(Math.max(currentTime, sampleStart + 0.25));
  };

  return (
    <div className="topic-dark relative h-dvh overflow-hidden text-[var(--color-white)]">
      <PerspectiveBackground
        imageSrc={perspective?.image_src}
        overlayClassName="bg-black/45"
      />
      {audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            if (!Number.isFinite(duration) || duration <= 0) return;
            if (urlEndTime !== undefined || perspective?.end_time !== undefined) {
              return;
            }
            setSampleEnd((previous) =>
              clampTime(previous, sampleStart + 0.25, duration),
            );
          }}
          onTimeUpdate={(event) => {
            if (!isPlaying) return;
            setCurrentTime(event.currentTarget.currentTime);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setPreviewEndTime(null);
          }}
        >
          <track kind="captions" />
        </audio>
      ) : null}
      <div className="relative z-10 mx-auto flex h-dvh w-full max-w-5xl flex-col md:grid md:grid-cols-[minmax(320px,420px)_1fr] md:gap-6 md:px-6 md:py-6">
        <section className="flex h-dvh min-h-0 flex-col bg-black/10 backdrop-blur-sm md:h-[calc(100dvh-3rem)] md:overflow-hidden md:rounded-lg md:border md:border-white/15">
          {hasProductionNav ? (
            <header className="shrink-0 border-b border-white/10 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <nav
                className="scrollbar-transparent flex min-h-10 items-center gap-2 overflow-x-auto whitespace-nowrap"
                aria-label="Timing editor navigation"
              >
                <Link
                  to={topicHref}
                  preload="intent"
                  viewTransition
                  className="unstyled-link inline-flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-transparent text-[2rem] leading-none text-white/85 transition hover:text-white"
                  aria-label={NAV_ITEMS.topic.label}
                  title={NAV_ITEMS.topic.label}
                >
                  {NAV_ITEMS.topic.icon}
                </Link>
                <span className="h-6 w-px shrink-0 bg-white/15" />
                {navigationLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    preload="intent"
                    viewTransition
                    className="unstyled-link inline-flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-transparent text-[2rem] leading-none text-white/80 transition hover:text-white"
                    aria-label={link.label}
                    title={link.label}
                  >
                    {link.icon}
                  </Link>
                ))}
              </nav>
            </header>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="flex flex-wrap content-center gap-x-2 gap-y-3 text-[clamp(1.8rem,8vw,2.9rem)] font-semibold leading-[1.08]">
              {words.map((word, index) => {
                const isSelected = selectedIndex === index;
                const isActive = activeWordIndex === index;
                const isTimed = Boolean(timings[index]);
                return (
                  <button
                    key={`${word}-${index}`}
                    type="button"
                    onClick={() => selectWord(index)}
                    className={`relative rounded-md border-0 bg-transparent px-1 pb-[0.12em] pt-[0.02em] text-left leading-[1.12] transition ${
                      isSelected
                        ? "bg-[var(--color-white)] text-[var(--color-black)]"
                        : isActive
                          ? "bg-[var(--color-neon-teal)] text-[var(--color-black)]"
                          : isTimed
                            ? "text-[var(--color-white)]"
                            : "text-[color-mix(in_oklch,var(--color-white),transparent_52%)]"
                    }`}
                  >
                    {word}
                    {isTimed ? (
                      <span
                        aria-hidden="true"
                        className={`absolute inset-x-1 bottom-0 h-0.5 rounded-full ${
                          isSelected
                            ? "bg-[var(--color-neon-magenta)]"
                            : "bg-[var(--color-neon-orange)]"
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[65dvh] shrink-0 overflow-y-auto border-t border-white/10 bg-black/20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 scrollbar-transparent backdrop-blur-sm">
            <AudioWaveform
              waveform={waveform}
              playheadPercent={playheadPercent}
              selectionLeftPercent={
                hasSelectedWord ? selectedLeftPercent : undefined
              }
              selectionWidthPercent={
                hasSelectedWord ? selectedWidthPercent : undefined
              }
            />

            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {PLAYBACK_RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={playbackRate === rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`h-9 rounded-lg text-sm font-semibold tabular-nums ${
                    playbackRate === rate
                      ? "bg-[var(--color-neon-orange)] text-[var(--color-black)]"
                      : "bg-white/[0.06] text-[color-mix(in_oklch,var(--color-white),transparent_18%)]"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {hasSelectedWord ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {words[selectedIndex]}
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                      word {selectedIndex + 1} of {words.length}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-[var(--color-white)]">
                    {formatTime(currentTime)}
                  </p>
                </div>

                <div className="mt-2 grid gap-2">
                  <div className="grid grid-cols-[4.75rem_2.75rem_1fr_2.75rem] items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                      Start
                    </span>
                    <button
                      type="button"
                      onClick={() => nudgeSelected(-WORD_STEP_SECONDS)}
                      className="h-10 rounded-lg bg-white/[0.07] text-lg font-semibold"
                      aria-label="Move selected word start earlier"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStart(currentTime)}
                      className="h-10 rounded-lg bg-[var(--color-white)] px-2 text-sm font-semibold tabular-nums text-[var(--color-black)]"
                      aria-label="Set selected word start to playhead"
                    >
                      {formatTime(selectedStart)}
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeSelected(WORD_STEP_SECONDS)}
                      className="h-10 rounded-lg bg-white/[0.07] text-lg font-semibold"
                      aria-label="Move selected word start later"
                    >
                      +
                    </button>
                  </div>
                  <div className="grid grid-cols-[4.75rem_2.75rem_1fr_2.75rem] items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                      Duration
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDuration(selectedDuration - WORD_STEP_SECONDS)
                      }
                      className="h-10 rounded-lg bg-white/[0.07] text-lg font-semibold"
                      aria-label="Shorten selected word duration"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDuration(currentTime - selectedStart)
                      }
                      className="h-10 rounded-lg bg-[var(--color-white)] px-2 text-sm font-semibold tabular-nums text-[var(--color-black)]"
                      aria-label="Set selected word duration to playhead"
                    >
                      {selectedDuration.toFixed(2)}s
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedDuration(selectedDuration + WORD_STEP_SECONDS)
                      }
                      className="h-10 rounded-lg bg-white/[0.07] text-lg font-semibold"
                      aria-label="Lengthen selected word duration"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-right text-xs tabular-nums text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                  ends {formatTime(selectedEnd)}
                </p>
              </div>
            ) : null}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={previewSelectedWord}
                aria-label="Preview selected word"
                title="Preview selected word"
                className="h-11 rounded-lg bg-[var(--color-neon-orange)] text-[2rem] leading-none text-[var(--color-black)] disabled:cursor-not-allowed disabled:opacity-35"
                disabled={!hasSelectedWord}
              >
                🔁
              </button>
              <button
                type="button"
                onClick={previewSample}
                aria-label="Preview sample"
                title="Preview sample"
                className="h-11 rounded-lg bg-white/[0.06] text-[2rem] leading-none"
              >
                🎧
              </button>
            </div>

            <div className="mt-2 grid grid-cols-[3.5rem_3.5rem_1fr] gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrentTime((value) =>
                    clampTime(value - 1, sampleStart, sampleEnd),
                  )
                }
                className="h-11 rounded-lg bg-white/[0.06] text-lg"
                aria-label="Seek backward"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="h-11 rounded-lg bg-[var(--color-white)] text-lg font-semibold text-[var(--color-black)]"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? "||" : ">"}
              </button>
              <button
                type="button"
                onPointerDown={markStart}
                onPointerUp={markEnd}
                onPointerCancel={markEnd}
                onKeyDown={(event) => {
                  if (event.repeat || event.key !== " ") return;
                  markStart();
                }}
                onKeyUp={(event) => {
                  if (event.key !== " ") return;
                  markEnd();
                }}
                className={`h-11 rounded-lg text-base font-bold ${
                  isMarking
                    ? "bg-[var(--color-neon-magenta)] text-[var(--color-white)]"
                    : "bg-[var(--color-neon-teal)] text-[var(--color-black)]"
                } text-[2rem] leading-none disabled:cursor-not-allowed disabled:opacity-35`}
                aria-label={
                  isMarking ? "Marking word timing" : "Mark word timing"
                }
                title={isMarking ? "Marking word timing" : "Mark word timing"}
                disabled={!hasSelectedWord}
              >
                {isMarking ? "⏱️" : "✍️"}
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBound("start")}
                aria-label="Set sample start"
                title="Set sample start"
                className="h-11 rounded-lg bg-white/[0.06] text-[2rem] leading-none"
              >
                ⏮️
              </button>
              <button
                type="button"
                onClick={() => setBound("end")}
                aria-label="Set sample end"
                title="Set sample end"
                className="h-11 rounded-lg bg-white/[0.06] text-[2rem] leading-none"
              >
                ⏭️
              </button>
            </div>
          </div>
        </section>

        {hasSelectedWord ? (
          <aside className="hidden h-[calc(100dvh-3rem)] min-h-0 flex-col gap-3 md:flex">
            <section className="rounded-lg border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                Selected word
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatTime(selectedStart)}
                  </p>
                  <p className="text-sm text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                    start
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {selectedDuration.toFixed(2)}s
                  </p>
                  <p className="text-sm text-[color-mix(in_oklch,var(--color-neon-teal),white_20%)]">
                    duration
                  </p>
                </div>
              </div>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
