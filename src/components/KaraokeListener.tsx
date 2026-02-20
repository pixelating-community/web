"use client";

import type { CSSProperties, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KaraokePresenter } from "@/components/KaraokePresenter";
import { PerspectiveBackground } from "@/components/PerspectiveBackground";
import { PerspectiveModeNav } from "@/components/PerspectiveModeNav";
import {
  applyKaraokeStyleSuggestion,
  findPhraseForWord,
  getKaraokeStyleSuggestions,
  getKaraokePhrasesFromSymbols,
  getKaraokeWordInlineStyle,
  getPhraseBounds,
  nextColorIndex,
  PHRASE_GRADIENTS,
  sanitizeWordClasses,
  type Phrase,
} from "@/lib/karaokePhrases";
import { saveKaraokePhrases } from "@/lib/karaokePhrases.functions";
import { setPerspectiveBounds } from "@/lib/perspectiveBounds.functions";
import { resolvePerspectiveBackgroundImageSrc } from "@/lib/perspectiveImage";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";
import type { Perspective } from "@/types/perspectives";

const SYNC_MAX_FPS = 24;
const SYNC_INTERVAL_MS = 1000 / SYNC_MAX_FPS;
const SYNC_MIN_DELTA = 0.005;

const formatBoundTime = (value: number) => {
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue - minutes * 60;
  return minutes > 0
    ? `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`
    : `${seconds.toFixed(2)}s`;
};

type BoundField = "startTime" | "endTime";
type BoundSaveStatus = "idle" | "saving" | "saved" | "error";

const getBoundButtonLabel = ({
  base,
  status,
}: {
  base: string;
  status: BoundSaveStatus;
}) => {
  if (status === "saving") return `${base}...`;
  if (status === "saved") return `${base} saved`;
  if (status === "error") return `${base} error`;
  return base;
};

const getBoundButtonClass = (status: BoundSaveStatus) => {
  const statusClass = {
    error: "text-red-200",
    idle: "text-white/85 hover:text-white",
    saved: "text-emerald-200",
    saving: "text-amber-100",
  }[status];
  return `inline-flex h-10 items-center justify-center border-0 bg-transparent px-2 text-xs font-medium uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-30 ${statusClass}`;
};

type KaraokeListenerProps = {
  perspective: Perspective;
  topicName: string;
  topicId?: string;
  actionToken?: string;
  canWrite?: boolean;
  editable?: boolean;
  videoSrc?: string;
  imageSrc?: string;
  startTime?: number;
  endTime?: number;
  onBoundsSaved?: () => Promise<void> | void;
};

export const KaraokeListener = ({
  perspective,
  topicName,
  topicId,
  actionToken,
  canWrite = false,
  editable = false,
  videoSrc,
  imageSrc,
  startTime,
  endTime,
  onBoundsSaved,
}: KaraokeListenerProps) => {
  const router = useRouter();
  const setBoundsFn = useServerFn(setPerspectiveBounds);
  const savePhrasesFn = useServerFn(saveKaraokePhrases);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [boundButtonStatus, setBoundButtonStatus] = useState<Record<BoundField, BoundSaveStatus>>({
    endTime: "idle",
    startTime: "idle",
  });
  const [boundsError, setBoundsError] = useState("");
  const currentTimeRef = useRef(startTime ?? 0);
  const [currentTime, setCurrentTime] = useState(startTime ?? 0);
  const [activePhrase, setActivePhrase] = useState<Phrase | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [styleInput, setStyleInput] = useState("");
  const [styleStatus, setStyleStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const styleInputRef = useRef<HTMLInputElement | null>(null);
  const [savedBounds, setSavedBounds] = useState<{
    endTime?: number;
    startTime?: number;
  }>({
    endTime,
    startTime,
  });
  const activePhraseRef = useRef(activePhrase);
  activePhraseRef.current = activePhrase;
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;
  const styleSuggestions = useMemo(
    () => getKaraokeStyleSuggestions(styleInput),
    [styleInput],
  );

  useEffect(() => {
    const storedPhrases = getKaraokePhrasesFromSymbols(perspective.symbols);
    setPhrases(storedPhrases);
    setActivePhrase(null);
    setSelectionStart(null);
  }, [perspective.id, perspective.symbols]);

  const timings = perspective.wordTimings ?? [];
  const resolvedAudioSrc = useMemo(
    () =>
      resolvePublicAudioSrc(perspective.recording_src) ||
      resolvePublicAudioSrc(perspective.audio_src),
    [perspective.audio_src, perspective.recording_src],
  );
  const backgroundImageSrc = useMemo(
    () => imageSrc?.trim() || resolvePerspectiveBackgroundImageSrc(perspective),
    [imageSrc, perspective],
  );
  const isSavingBounds =
    boundButtonStatus.startTime === "saving" ||
    boundButtonStatus.endTime === "saving";

  const setBoundStatus = useCallback(
    (field: BoundField, status: BoundSaveStatus) => {
      setBoundButtonStatus((previous) => ({
        ...previous,
        [field]: status,
      }));
    },
    [],
  );

  const inferDefaultEndTime = useCallback(() => {
    const mediaDuration = mediaRef.current?.duration;
    if (
      typeof mediaDuration === "number" &&
      Number.isFinite(mediaDuration) &&
      mediaDuration > 0
    ) {
      return mediaDuration;
    }
    if (typeof endTime === "number" && Number.isFinite(endTime) && endTime > 0) {
      return endTime;
    }
    let lastTimingEnd = 0;
    for (const timing of timings) {
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
  }, [endTime, timings]);

  const getBoundTime = useCallback(
    (field: BoundField) => {
      const current = currentTimeRef.current;
      if (!Number.isFinite(current)) return undefined;
      const currentTime = Math.max(0, current);
      if (
        field === "endTime" &&
        savedBounds.endTime === undefined &&
        currentTime <= SYNC_MIN_DELTA
      ) {
        return inferDefaultEndTime() ?? currentTime;
      }
      return currentTime;
    },
    [inferDefaultEndTime, savedBounds.endTime],
  );

  const persistPhrases = useCallback(
    async (nextPhrases: Phrase[], showStyleFeedback = false) => {
      if (!editable || !actionToken || !topicId) return true;
      if (showStyleFeedback) {
        setStyleStatus("saving");
      }
      try {
        const result = await savePhrasesFn({
          data: {
            actionToken,
            perspectiveId: perspective.id,
            phrases: nextPhrases,
            topicId,
          },
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        if (showStyleFeedback) {
          setStyleStatus("saved");
        }
        return true;
      } catch {
        if (showStyleFeedback) {
          setStyleStatus("error");
        }
        return false;
      }
    },
    [
      actionToken,
      editable,
      perspective.id,
      savePhrasesFn,
      topicId,
    ],
  );

  const commitCurrentTime = useCallback(
    (time: number, forceRender = false) => {
      if (!Number.isFinite(time)) return;
      const next = Math.max(0, time);
      currentTimeRef.current = next;
      setCurrentTime((prev) => {
        if (forceRender) return next;
        return Math.abs(prev - next) >= SYNC_MIN_DELTA ? next : prev;
      });
    },
    [],
  );

  const handleTogglePlayback = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.muted = false;
    media.volume = 1;

    if (!media.paused) {
      media.pause();
      return;
    }

    if (media.ended || (Number.isFinite(media.duration) && media.currentTime >= media.duration - 0.05)) {
      media.currentTime = startTime ?? 0;
      commitCurrentTime(startTime ?? 0, true);
    } else if (startTime !== undefined && startTime > 0 && media.currentTime < startTime - 0.1) {
      media.currentTime = startTime;
      commitCurrentTime(startTime, true);
    }
    if (media.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      media.load();
    }
    void media.play().catch(() => {});
  }, [commitCurrentTime, startTime]);

  const saveBound = useCallback(
    async (field: BoundField) => {
      if (!editable || !actionToken || !topicId) return;
      const boundTime = getBoundTime(field);
      if (boundTime === undefined) return;

      setBoundStatus(field, "saving");
      setBoundsError("");
      try {
        const defaultEndTime = inferDefaultEndTime();
        const result = await setBoundsFn({
          data: {
            actionToken,
            currentPath:
              typeof window === "undefined"
                ? undefined
                : `${window.location.pathname}${window.location.search}${window.location.hash}`,
            defaultEndTime,
            defaultStartTime: 0,
            perspectiveId: perspective.id,
            topicId,
            [field]: boundTime,
          },
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        const nextBounds = {
          endTime:
            typeof result.endTime === "number" ? result.endTime : undefined,
          startTime:
            typeof result.startTime === "number" ? result.startTime : undefined,
        };
        setSavedBounds(nextBounds);
        if (result.href) {
          await router.navigate({
            href: result.href,
            replace: true,
          });
        }
        await onBoundsSaved?.();
        setBoundStatus(field, "saved");
      } catch (error) {
        setBoundStatus(field, "error");
        setBoundsError(
          error instanceof Error ? error.message : "Failed to save sample bounds",
        );
      }
    },
    [
      actionToken,
      editable,
      getBoundTime,
      inferDefaultEndTime,
      onBoundsSaved,
      perspective.id,
      router,
      setBoundsFn,
      setBoundStatus,
      topicId,
    ],
  );

  useEffect(() => {
    setSavedBounds({
      endTime,
      startTime,
    });
  }, [endTime, startTime]);

  const phraseKey = useCallback((phrase: Phrase | null) => {
    if (!phrase) return "";
    return `${phrase.startIndex}:${phrase.endIndex}:${phrase.colorIndex}:${phrase.midiNote ?? ""}`;
  }, []);

  const handleSelectWord = useCallback(
    (index: number, time?: number) => {
      if (!editable) return;
      setStyleStatus("idle");
      if (typeof time === "number" && Number.isFinite(time)) {
        commitCurrentTime(time, true);
      }
      const existing = findPhraseForWord(phrasesRef.current, index);
      if (existing) {
        setSelectionStart(null);
        const isActive = phraseKey(activePhraseRef.current) === phraseKey(existing);
        setActivePhrase(isActive ? null : existing);
        const bounds = getPhraseBounds(timings, existing);
        if (bounds) {
          const media = mediaRef.current;
          if (media) media.currentTime = bounds.start;
          commitCurrentTime(bounds.start, true);
        }
        return;
      }

      if (selectionStart === null) {
        setActivePhrase(null);
        setSelectionStart(index);
        return;
      }

      const startIndex = Math.min(selectionStart, index);
      const endIndex = Math.max(selectionStart, index);
      const newPhrase: Phrase = {
        startIndex,
        endIndex,
        colorIndex: nextColorIndex(phrasesRef.current),
      };
      const nextPhrases = [...phrasesRef.current, newPhrase];
      setSelectionStart(null);
      setActivePhrase(newPhrase);
      setPhrases(nextPhrases);
      void persistPhrases(nextPhrases);
    },
    [commitCurrentTime, editable, persistPhrases, phraseKey, selectionStart, timings],
  );

  const handleDoubleSelectWord = useCallback(
    (index: number, time?: number) => {
      if (!editable) return;
      setStyleStatus("idle");
      if (typeof time === "number" && Number.isFinite(time)) {
        commitCurrentTime(time, true);
      }
      setSelectionStart(null);
      const existing = findPhraseForWord(phrasesRef.current, index);
      if (existing) {
        setActivePhrase(existing);
        const bounds = getPhraseBounds(timings, existing);
        if (bounds) {
          const media = mediaRef.current;
          if (media) media.currentTime = bounds.start;
          commitCurrentTime(bounds.start, true);
        }
        return;
      }
      const newPhrase: Phrase = {
        startIndex: index,
        endIndex: index,
        colorIndex: nextColorIndex(phrasesRef.current),
      };
      const nextPhrases = [...phrasesRef.current, newPhrase];
      setActivePhrase(newPhrase);
      setPhrases(nextPhrases);
      void persistPhrases(nextPhrases);
    },
    [commitCurrentTime, editable, persistPhrases, timings],
  );

  const phraseStyles = useMemo(() => {
    const styles: Record<number, {
      classes?: string[];
      gradientStart?: string;
      gradientEnd?: string;
      inlineStyle?: CSSProperties;
    }> = {};
    for (const phrase of phrases) {
      const gradient = PHRASE_GRADIENTS[phrase.colorIndex % PHRASE_GRADIENTS.length];
      const inlineStyle = getKaraokeWordInlineStyle(phrase.classes) as
        | CSSProperties
        | undefined;
      for (let index = phrase.startIndex; index <= phrase.endIndex; index += 1) {
        styles[index] = {
          classes: phrase.classes,
          gradientStart: gradient.start,
          gradientEnd: gradient.end,
          inlineStyle,
        };
      }
    }
    return styles;
  }, [phrases]);

  useEffect(() => {
    setStyleInput(activePhrase?.classes?.join(" ") ?? "");
  }, [activePhrase]);

  useEffect(() => {
    if (!editable || !activePhrase) return;
    const frame = requestAnimationFrame(() => {
      styleInputRef.current?.focus();
      styleInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [activePhrase, editable]);

  const handleStyleSubmit = useCallback(() => {
    if (!activePhrase) return;
    const activeKey = phraseKey(activePhrase);
    const classes = sanitizeWordClasses(styleInput);
    if (styleInput.trim().length > 0 && classes.length === 0) {
      setStyleStatus("error");
      return;
    }
    const nextActive = {
      ...activePhrase,
      classes: classes.length > 0 ? classes : undefined,
    };
    const nextPhrases = phrasesRef.current.map((phrase) =>
        phraseKey(phrase) === activeKey ? nextActive : phrase,
    );
    setPhrases(nextPhrases);
    setActivePhrase(nextActive);
    void persistPhrases(nextPhrases, true);
  }, [activePhrase, persistPhrases, phraseKey, styleInput]);

  const handleStyleSuggestionSelect = useCallback((suggestion: string) => {
    setStyleInput((current) => applyKaraokeStyleSuggestion(current, suggestion));
    setStyleStatus("idle");
    requestAnimationFrame(() => {
      styleInputRef.current?.focus();
    });
  }, []);

  const handleRemovePhrase = useCallback(() => {
    if (!activePhrase) return;
    const activeKey = phraseKey(activePhrase);
    const nextPhrases = phrasesRef.current.filter(
      (phrase) => phraseKey(phrase) !== activeKey,
    );
    setPhrases(nextPhrases);
    setActivePhrase(null);
    void persistPhrases(nextPhrases, true);
  }, [activePhrase, persistPhrases, phraseKey]);

  // Seed media.currentTime from ?s= once metadata is available
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;
    if (startTime === undefined || startTime <= 0) return;

    let applied = false;
    const apply = () => {
      if (applied) return;
      applied = true;
      media.currentTime = startTime;
      commitCurrentTime(startTime, true);
    };

    if (media.readyState >= 1 && Number.isFinite(media.duration)) {
      apply();
    } else {
      media.addEventListener("loadedmetadata", apply, { once: true });
    }
    return () => {
      media.removeEventListener("loadedmetadata", apply);
    };
  }, [commitCurrentTime, startTime]);

  // Media event listeners
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handlePlaying = () => {
      commitCurrentTime(media.currentTime, true);
      setIsPlaying(true);
    };
    const handlePause = () => {
      commitCurrentTime(media.currentTime, true);
      setIsPlaying(false);
    };
    const handleEnded = () => {
      commitCurrentTime(media.currentTime, true);
      setIsPlaying(false);
    };

    media.addEventListener("playing", handlePlaying);
    media.addEventListener("pause", handlePause);
    media.addEventListener("ended", handleEnded);
    return () => {
      media.removeEventListener("playing", handlePlaying);
      media.removeEventListener("pause", handlePause);
      media.removeEventListener("ended", handleEnded);
    };
  }, [commitCurrentTime]);

  // Throttled RAF loop with phrase loop enforcement
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number | null = null;
    let lastSampleMs = 0;

    const tick = (timestamp: number) => {
      if (lastSampleMs === 0 || timestamp - lastSampleMs >= SYNC_INTERVAL_MS) {
        lastSampleMs = timestamp;
        const media = mediaRef.current;
        if (media && Number.isFinite(media.currentTime)) {
          if (media.paused || media.ended) {
            setIsPlaying(false);
            commitCurrentTime(media.currentTime, true);
            rafId = requestAnimationFrame(tick);
            return;
          }

          // Phrase loop enforcement
          const phrase = activePhraseRef.current;
          if (phrase) {
            const bounds = getPhraseBounds(timings, phrase);
            if (bounds && media.currentTime >= bounds.end - 0.02) {
              media.currentTime = bounds.start;
              commitCurrentTime(bounds.start, true);
              rafId = requestAnimationFrame(tick);
              return;
            }
          }

          // End-time boundary
          if (endTime !== undefined && media.currentTime >= endTime - 0.02) {
            media.pause();
            media.currentTime = endTime;
            commitCurrentTime(endTime, true);
            setIsPlaying(false);
            return;
          }

          commitCurrentTime(media.currentTime);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [commitCurrentTime, endTime, isPlaying, timings]);

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-hidden">
      <PerspectiveModeNav
        canWrite={canWrite}
        currentMode={editable ? "karaoke-editor" : "karaoke"}
        perspectiveId={perspective.id}
        topicName={topicName}
      />
      {videoSrc ? (
        // Background video — drives currentTime for karaoke sync
        // oxlint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={mediaRef as RefObject<HTMLVideoElement | null>}
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src={videoSrc}
          playsInline
          preload="auto"
        />
      ) : null}
      {!videoSrc ? (
        <PerspectiveBackground imageSrc={backgroundImageSrc} />
      ) : null}
      <div className="flex w-screen flex-1 min-h-0 items-center justify-center overflow-hidden relative z-10">
        <div className="flex h-full w-full items-center justify-center">
          <KaraokePresenter
            perspective={perspective}
            timings={timings}
            audioRef={mediaRef}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTogglePlayback={handleTogglePlayback}
            activePhraseRange={activePhrase}
            selectedWordIndex={selectionStart ?? activePhrase?.startIndex}
            wordStyles={phraseStyles}
            onSelectWord={handleSelectWord}
            onDoubleSelectWord={handleDoubleSelectWord}
          />
          {editable ? (
            <div className="absolute bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-20 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center justify-center gap-1">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void saveBound("startTime");
                  }}
                  disabled={!actionToken || !topicId || isSavingBounds}
                  aria-label="Set sample start"
                  title="Set sample start"
                  className={getBoundButtonClass(boundButtonStatus.startTime)}
                >
                  {getBoundButtonLabel({
                    base: "Start",
                    status: boundButtonStatus.startTime,
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void saveBound("endTime");
                  }}
                  disabled={!actionToken || !topicId || isSavingBounds}
                  aria-label="Set sample end"
                  title="Set sample end"
                  className={getBoundButtonClass(boundButtonStatus.endTime)}
                >
                  {getBoundButtonLabel({
                    base: "End",
                    status: boundButtonStatus.endTime,
                  })}
                </button>
                {boundsError ? (
                  <output className="text-xs text-red-200" role="alert">
                    {boundsError}
                  </output>
                ) : null}
                {activePhrase ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleStyleSubmit();
                    }}
                    className="relative inline-flex items-center gap-1"
                  >
                    {styleSuggestions.length > 0 ? (
                      <div className="absolute bottom-full left-0 mb-1 flex max-w-[min(22rem,calc(100vw-2rem))] flex-wrap gap-1 rounded bg-black/70 p-1 shadow-lg backdrop-blur-sm">
                        {styleSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                            }}
                            onClick={() => {
                              handleStyleSuggestionSelect(suggestion);
                            }}
                            className="h-7 rounded border border-white/10 bg-white/10 px-2 text-[11px] text-white/80 hover:bg-white/20 hover:text-white touch-manipulation"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <input
                      ref={styleInputRef}
                      type="text"
                      value={styleInput}
                      onChange={(event) => {
                        setStyleInput(event.target.value);
                        setStyleStatus("idle");
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Tab" || styleSuggestions.length === 0) {
                          return;
                        }
                        event.preventDefault();
                        handleStyleSuggestionSelect(styleSuggestions[0]);
                      }}
                      placeholder="text-4xl font-bold"
                      className="h-8 w-40 rounded border border-white/20 bg-black/35 px-2 text-xs text-white outline-none placeholder:text-white/35"
                      aria-label="Phrase style classes"
                    />
                    <button
                      type="submit"
                      className={`inline-flex h-8 items-center rounded border-0 bg-white/10 px-2 text-xs hover:text-white touch-manipulation ${
                        styleStatus === "saved"
                          ? "text-emerald-200"
                          : styleStatus === "error"
                            ? "text-red-200"
                            : "text-white/80"
                      }`}
                      aria-label="Apply phrase style"
                      title="Apply phrase style"
                    >
                      {styleStatus === "saved"
                        ? "✓"
                        : styleStatus === "error"
                          ? "!"
                          : styleStatus === "saving"
                            ? "..."
                            : "🎨"}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePhrase}
                      className="inline-flex h-8 items-center rounded border-0 bg-white/10 px-2 text-xs text-white/80 hover:text-white touch-manipulation"
                      aria-label="Remove phrase"
                      title="Remove phrase"
                    >
                      ✕
                    </button>
                  </form>
                ) : null}
              </div>
              {savedBounds.startTime !== undefined || savedBounds.endTime !== undefined ? (
                <output className="text-[11px] text-white/60" aria-live="polite">
                  {savedBounds.startTime !== undefined
                    ? `Start ${formatBoundTime(savedBounds.startTime)}`
                    : "Start unset"}
                  {" · "}
                  {savedBounds.endTime !== undefined
                    ? `End ${formatBoundTime(savedBounds.endTime)}`
                    : "End unset"}
                </output>
              ) : null}
            </div>
          ) : null}
          {/* Hidden audio fallback when no video */}
          {!videoSrc ? (
            // oxlint-disable-next-line jsx-a11y/media-has-caption
            <audio
              ref={mediaRef as RefObject<HTMLAudioElement | null>}
              className="opacity-0 w-px h-px absolute"
              src={resolvedAudioSrc}
              preload={editable || (startTime && startTime > 0) ? "metadata" : "none"}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
