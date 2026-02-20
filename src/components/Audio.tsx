"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1];
const RAF_MAX_UPDATE_FPS = 60;
const RAF_MIN_INTERVAL_MS = 1000 / RAF_MAX_UPDATE_FPS;

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return "0:00.00";
  const totalCentiseconds = Math.max(0, Math.floor(value * 100));
  const minutes = Math.floor(totalCentiseconds / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
};

type AudioProps = {
  src: string;
  startTime?: number;
  endTime?: number;
  studio?: boolean;
  debugControls?: boolean;
  playbackRate?: number;
  defaultRate?: number;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  loop?: boolean;
  onTimeUpdate?: (time: number) => void;
  showPlayButton?: boolean;
  showScrubber?: boolean;
  seekStepSeconds?: number;
  onShiftBackward?: () => void;
  onShiftForward?: () => void;
  onPlaybackError?: (payload: {
    code: number | null;
    message: string | null;
    src: string;
  }) => void;
};

export const Audio = forwardRef<HTMLAudioElement, AudioProps>(
  (
      {
        src,
        startTime,
        endTime,
        studio,
      debugControls = false,
      playbackRate: controlledPlaybackRate,
      defaultRate,
      isPlaying,
      setIsPlaying,
      loop = true,
      onTimeUpdate,
      showPlayButton = true,
      showScrubber = true,
      seekStepSeconds = 0.05,
      onShiftBackward,
      onShiftForward,
      onPlaybackError,
    },
    ref,
  ) => {
    const audioRef = ref as React.RefObject<HTMLAudioElement>;
    const [playbackRate, setPlaybackRate] = useState(
      Number.isFinite(defaultRate) && defaultRate ? defaultRate : 1,
    );
    const effectivePlaybackRate =
      Number.isFinite(controlledPlaybackRate) && controlledPlaybackRate
        ? controlledPlaybackRate
        : playbackRate;
    const playbackRateRef = useRef(effectivePlaybackRate);
    const lastPlayRequestAtRef = useRef(0);
    const playIntentUntilRef = useRef(0);
    const lastPointerToggleAtRef = useRef(0);
    const [displayTime, setDisplayTime] = useState(0);
    const rafRef = useRef<number | null>(null);
    const lastRafUpdateMsRef = useRef<number>(0);
    const resolvedSrc = useMemo(() => resolvePublicAudioSrc(src), [src]);
    const cyclePlaybackRate = useCallback(() => {
      if (Number.isFinite(controlledPlaybackRate) && controlledPlaybackRate) {
        return;
      }
      setPlaybackRate((prev) => {
        const currentIndex = Math.max(PLAYBACK_RATES.indexOf(prev), 0);
        const nextRate =
          PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
        if (audioRef?.current) {
          audioRef.current.playbackRate = nextRate;
        }
        return nextRate;
      });
    }, [audioRef, controlledPlaybackRate]);

    const handleTimeUpdate = useCallback(() => {
      if (!audioRef?.current) return;
      const audio = audioRef.current;
      const currentSeconds = audio.currentTime;
      setDisplayTime(currentSeconds);
      onTimeUpdate?.(currentSeconds);

      if (
        startTime !== undefined &&
        endTime &&
        currentSeconds >= endTime - 0.05
      ) {
        audio.pause();
        setTimeout(() => {
          if (audioRef.current) {
            if (loop) {
              audioRef.current.currentTime = startTime;
              audioRef.current.play().catch(() => {});
            } else {
              audioRef.current.currentTime = endTime;
            }
          }
        }, 0);
      }
    }, [
      audioRef,
      startTime,
      endTime,
      loop,
      onTimeUpdate,
    ]);

    useEffect(() => {
      if (!isPlaying) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        lastRafUpdateMsRef.current = 0;
        return;
      }

      const tick = (timestamp: number) => {
        const elapsed = timestamp - lastRafUpdateMsRef.current;
        if (
          elapsed >= RAF_MIN_INTERVAL_MS ||
          lastRafUpdateMsRef.current === 0
        ) {
          lastRafUpdateMsRef.current = timestamp;
          handleTimeUpdate();
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        lastRafUpdateMsRef.current = 0;
      };
    }, [handleTimeUpdate, isPlaying]);

    useEffect(() => {
      if (!resolvedSrc || !audioRef?.current) return;
      const audio = audioRef.current;
      // Sync once immediately in case metadata was already loaded from cache.
      handleTimeUpdate();
      audio.addEventListener("loadedmetadata", handleTimeUpdate);
      audio.addEventListener("loadeddata", handleTimeUpdate);
      audio.addEventListener("canplay", handleTimeUpdate);
      audio.addEventListener("durationchange", handleTimeUpdate);
      return () => {
        audio.removeEventListener("loadedmetadata", handleTimeUpdate);
        audio.removeEventListener("loadeddata", handleTimeUpdate);
        audio.removeEventListener("canplay", handleTimeUpdate);
        audio.removeEventListener("durationchange", handleTimeUpdate);
      };
    }, [resolvedSrc, handleTimeUpdate, audioRef]);

    useEffect(() => {
      if (!audioRef?.current) return;
      const audio = audioRef.current;
      if (isPlaying && audio.paused) {
        audio.play().catch((reason) => {
          if (
            reason instanceof Error &&
            (reason.name === "NotAllowedError" ||
              reason.name === "AbortError" ||
              reason.message.includes("not allowed"))
          ) {
            setIsPlaying(false);
          }
        });
      } else if (!isPlaying && !audio.paused) {
        if (performance.now() < playIntentUntilRef.current) {
          return;
        }
        audio.pause();
      }
    }, [isPlaying, audioRef, setIsPlaying]);

    useEffect(() => {
      if (!audioRef?.current) return;
      const audio = audioRef.current;
      const handlePlaying = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      audio.addEventListener("playing", handlePlaying);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("ended", handlePause);
      audio.addEventListener("emptied", handlePause);
      return () => {
        audio.removeEventListener("playing", handlePlaying);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("ended", handlePause);
        audio.removeEventListener("emptied", handlePause);
      };
    }, [audioRef, setIsPlaying]);

    useEffect(() => {
      if (!audioRef?.current) return;
      audioRef.current.playbackRate = effectivePlaybackRate;
      playbackRateRef.current = effectivePlaybackRate;
    }, [audioRef, effectivePlaybackRate]);

    useEffect(() => {
      if (!audioRef?.current || !resolvedSrc) return;
      audioRef.current.playbackRate = playbackRateRef.current;
    }, [audioRef, resolvedSrc]);

    useEffect(() => {
      if (!Number.isFinite(defaultRate) || !defaultRate) return;
      if (Number.isFinite(controlledPlaybackRate) && controlledPlaybackRate) {
        return;
      }
      setPlaybackRate((prev) => {
        if (prev === defaultRate) return prev;
        if (audioRef?.current) {
          audioRef.current.playbackRate = defaultRate;
        }
        return defaultRate;
      });
    }, [audioRef, controlledPlaybackRate, defaultRate]);

    const togglePlayPause = () => {
      const audio = audioRef?.current;
      if (!audio) return;
      if (import.meta.env.DEV) {
        console.trace("[Audio] toggle", {
          src: audio.currentSrc || resolvedSrc,
          paused: audio.paused,
          currentTime: audio.currentTime,
        });
      }
      if (!audio.paused) {
        const now = performance.now();
        if (
          now - lastPlayRequestAtRef.current < 500 &&
          audio.currentTime < 0.25
        ) {
          if (import.meta.env.DEV) {
            console.debug("[Audio] ignored immediate pause", {
              sincePlayMs: now - lastPlayRequestAtRef.current,
              currentTime: audio.currentTime,
            });
          }
          return;
        }
        if (import.meta.env.DEV) {
          console.trace("[Audio] pause request", {
            currentTime: audio.currentTime,
          });
        }
        audio.pause();
        return;
      }

      try {
        audio.muted = false;
        audio.volume = 1;
        const now = performance.now();
        lastPlayRequestAtRef.current = now;
        playIntentUntilRef.current = now + 500;
        if (
          audio.ended ||
          (Number.isFinite(audio.duration) &&
            audio.currentTime >= Math.max(0, audio.duration - 0.05))
        ) {
          audio.currentTime = 0;
          onTimeUpdate?.(0);
        }
        if (import.meta.env.DEV) {
          console.trace("[Audio] play request", {
            currentTime: audio.currentTime,
          });
        }
        const playPromise = audio.play();
        if (playPromise?.catch) {
          playPromise.catch((reason) => {
            setIsPlaying(false);
            onPlaybackError?.({
              code: audio.error?.code ?? null,
              message:
                audio.error?.message ??
                (reason instanceof Error
                  ? reason.message
                  : typeof reason === "string"
                    ? reason
                    : null),
              src: audio.currentSrc || resolvedSrc,
            });
          });
        }
      } catch (reason) {
        setIsPlaying(false);
        onPlaybackError?.({
          code: audio.error?.code ?? null,
          message:
            audio.error?.message ??
            (reason instanceof Error
              ? reason.message
              : typeof reason === "string"
                ? reason
                : null),
          src: audio.currentSrc || resolvedSrc,
        });
      }
    };

    const handleClick = () => {
      // Keep a single play() attempt inside the gesture so Safari does not
      // observe an immediate play-then-pause sequence from the custom control.
      togglePlayPause();
    };
    const handlePointerDown = (
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      lastPointerToggleAtRef.current = performance.now();
      togglePlayPause();
    };
    const handleButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      const now = performance.now();
      if (now - lastPointerToggleAtRef.current < 750) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      handleClick();
    };
    const handleAudioError = useCallback(() => {
      setIsPlaying(false);
      if (!onPlaybackError) return;
      const audio = audioRef?.current;
      onPlaybackError({
        code: audio?.error?.code ?? null,
        message: audio?.error?.message ?? null,
        src: audio?.currentSrc || resolvedSrc,
      });
    }, [audioRef, onPlaybackError, resolvedSrc, setIsPlaying]);

    const seekForward = () => {
      if (onShiftForward) {
        onShiftForward();
        return;
      }
      if (!audioRef?.current) return;
      const audio = audioRef.current;
      const max = Number.isFinite(audio.duration) ? audio.duration : Infinity;
      audio.currentTime = Math.min(max, audio.currentTime + seekStepSeconds);
      onTimeUpdate?.(audio.currentTime);
    };

    const seekBackward = () => {
      if (onShiftBackward) {
        onShiftBackward();
        return;
      }
      if (!audioRef?.current) return;
      const audio = audioRef.current;
      audio.currentTime = Math.max(0, audio.currentTime - seekStepSeconds);
      onTimeUpdate?.(audio.currentTime);
    };

    return (
      <div className="flex items-center justify-center w-full gap-x-1">
        {studio && (
          <button
            type="button"
            className="block bg-transparent text-[2rem] p-4 touch-manipulation select-none border-0 rounded-none"
            onClick={seekBackward}
          >
            {"◅"}
          </button>
        )}
        <div className="flex flex-col items-center justify-center">
          <audio
            className={
              debugControls
                ? "w-full max-w-full"
                : "opacity-0 w-px h-px absolute"
            }
            ref={ref}
            src={resolvedSrc}
            controls={debugControls}
            controlsList="nodownload noplaybackrate"
            loop={loop}
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onError={handleAudioError}
          >
            <track kind="captions" srcLang="en" default />
          </audio>
          {studio &&
            !(
              Number.isFinite(controlledPlaybackRate) && controlledPlaybackRate
            ) && (
              <button
                type="button"
                className="text-center rainbow text-[1rem] lg:text-[2rem] touch-manipulation select-none border-0 bg-transparent rounded-none"
                onClick={cyclePlaybackRate}
              >
                x{playbackRate}
              </button>
            )}
          {studio && (
            <div className="text-white/75">{formatTime(displayTime)}</div>
          )}
          {studio && showScrubber && (
            <input
              type="range"
              className="w-full appearance-none cursor-grab bg-orange-500 h-1 rounded-lg accent-[#6e11b0]"
              min={startTime || 0}
              max={endTime || audioRef?.current?.duration || 100}
              step="0.1"
              value={audioRef?.current?.currentTime || 0}
              onChange={(e) => {
                if (audioRef?.current) {
                  audioRef.current.currentTime = Number.parseFloat(
                    e.target.value,
                  );
                }
              }}
            />
          )}
          {showPlayButton && (
            <div className="flex h-[3.25rem] w-[3.25rem] items-center justify-center lg:h-[6.5rem] lg:w-[6.5rem]">
              <button
                type="button"
                className="rounded-none border-0 bg-transparent text-center text-[2rem] lg:text-[4rem] touch-manipulation select-none rainbow"
                onPointerDown={handlePointerDown}
                onClick={handleButtonClick}
              >
                {isPlaying ? "□" : "▷"}
              </button>
            </div>
          )}
        </div>
        {studio && (
          <button
            type="button"
            className="block bg-transparent text-[2rem] p-4 touch-manipulation select-none border-0 rounded-none"
            onClick={seekForward}
          >
            {"▻"}
          </button>
        )}
      </div>
    );
  },
);

Audio.displayName = "Audio";
