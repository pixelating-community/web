"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PerspectiveBackground } from "@/components/PerspectiveBackground";
import { PerspectiveModeNav } from "@/components/PerspectiveModeNav";
import { ReflectionPerspectiveCard } from "@/components/ReflectionPerspectiveCard";
import { SWEditor } from "@/components/SWEditor";
import { loadChildPerspectives } from "@/lib/childPerspectiveRoute.functions";
import { resolvePerspectiveBackgroundImageSrc } from "@/lib/perspectiveImage";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";
import { buildNewReflectionPerspectivePath } from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

type PerspectiveListenerProps = {
  perspective: Perspective;
  topicName: string;
  canWrite?: boolean;
  startTime?: number;
  endTime?: number;
  onPlaybackComplete?: (perspectiveId: string) => void;
};

const isBenignPlaybackRejection = (reason: unknown) => {
  if (
    reason instanceof DOMException &&
    (reason.name === "NotAllowedError" || reason.name === "AbortError")
  ) {
    return true;
  }

  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "";

  return /not allowed by the user agent or the platform|notallowederror|operation was aborted|aborterror/i.test(
    message,
  );
};

const isBenignMediaError = (error: MediaError | null) => {
  if (!error) return false;
  return error.code === MediaError.MEDIA_ERR_ABORTED;
};

const PerspectiveReflections = memo(function PerspectiveReflections({
  perspective,
  topicName,
  canWrite,
}: {
  perspective: Perspective;
  topicName: string;
  canWrite: boolean;
}) {
  const loadChildPerspectivesFn = useServerFn(loadChildPerspectives);
  const childPerspectivesQuery = useQuery({
    queryKey: ["child-perspectives", perspective.id],
    queryFn: () =>
      loadChildPerspectivesFn({
        data: { parentPerspectiveId: perspective.id },
      }),
    staleTime: 30_000,
  });
  const childPerspectives = (childPerspectivesQuery.data?.perspectives ??
    []) as Perspective[];

  if (childPerspectives.length === 0 && !canWrite) {
    return null;
  }

  return (
    <section id="reflections" className="border-t border-white/10 bg-black/20">
      <div className="mx-auto w-full max-w-5xl px-4 py-4 space-y-4">
        {childPerspectives.map((child) => (
          <ReflectionPerspectiveCard
            key={child.id}
            perspective={child}
            topicName={topicName}
          />
        ))}
        {canWrite && (
          <Link
            to={buildNewReflectionPerspectivePath({
              topicName,
              parentPerspectiveId: perspective.id,
            })}
            className="unstyled-link inline-flex items-center gap-2 text-sm text-white/60 hover:text-white/90 transition"
          >
            ⊕ Add reflection
          </Link>
        )}
      </div>
    </section>
  );
});

const SYNC_MAX_FPS = 24;
const SYNC_INTERVAL_MS = 1000 / SYNC_MAX_FPS;
const SYNC_MIN_DELTA = 0.005;

export const PerspectiveListener = ({
  perspective,
  topicName,
  canWrite = false,
  startTime,
  endTime,
  onPlaybackComplete,
}: PerspectiveListenerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const currentTimeRef = useRef(startTime ?? 0);
  const [currentTime, setCurrentTime] = useState(startTime ?? 0);
  const [playbackError, setPlaybackError] = useState<string>("");
  const [needsPlayGesture, setNeedsPlayGesture] = useState(false);
  const hasTimestampRange =
    startTime !== undefined && endTime !== undefined;
  const hasUrlTimestamp = startTime !== undefined || endTime !== undefined;
  const timings = perspective.wordTimings ?? [];
  const resolvedAudioSrc = useMemo(
    () =>
      resolvePublicAudioSrc(perspective.recording_src) ||
      resolvePublicAudioSrc(perspective.audio_src),
    [perspective.audio_src, perspective.recording_src],
  );
  const backgroundImageSrc = useMemo(
    () => resolvePerspectiveBackgroundImageSrc(perspective),
    [perspective],
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

  const logAudioState = (label: string, audio: HTMLAudioElement) => {
    if (!import.meta.env.DEV) return;
    console.debug(`[PerspectiveListener] ${label}`, {
      paused: audio.paused,
      currentTime: audio.currentTime,
      duration: audio.duration,
      ended: audio.ended,
      readyState: audio.readyState,
      networkState: audio.networkState,
      errorCode: audio.error?.code ?? null,
      errorMessage: audio.error?.message ?? null,
    });
  };

  const seekToStart = useCallback(
    (audio: HTMLAudioElement) => {
      const target = startTime ?? 0;
      audio.currentTime = target;
      commitCurrentTime(target, true);
    },
    [startTime, commitCurrentTime],
  );

  const playFromStart = useCallback(
    (audio: HTMLAudioElement) => {
      seekToStart(audio);
      audio.muted = false;
      audio.volume = 1;
      void audio.play().catch(() => {});
    },
    [seekToStart],
  );

  // Autoplay attempt on mount when URL has timestamps
  useEffect(() => {
    if (!hasUrlTimestamp) return;
    const audio = audioRef.current;
    if (!audio || !resolvedAudioSrc) return;

    const attemptPlay = () => {
      seekToStart(audio);
      audio.muted = false;
      audio.volume = 1;
      void audio
        .play()
        .then(() => {
          setNeedsPlayGesture(false);
        })
        .catch((reason) => {
          if (
            reason instanceof DOMException &&
            reason.name === "NotAllowedError"
          ) {
            setNeedsPlayGesture(true);
          }
        });
    };

    if (audio.readyState >= 1) {
      attemptPlay();
    } else {
      audio.load();
      audio.addEventListener("loadedmetadata", attemptPlay, { once: true });
      return () => audio.removeEventListener("loadedmetadata", attemptPlay);
    }
  }, [hasUrlTimestamp, resolvedAudioSrc, seekToStart]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlaying = () => {
      logAudioState("playing", audio);
      setPlaybackError("");
      commitCurrentTime(audio.currentTime, true);
      setIsPlaying(true);
    };
    const handlePause = () => {
      logAudioState("pause", audio);
      commitCurrentTime(audio.currentTime, true);
      setIsPlaying(false);
    };
    const handleEnded = () => {
      logAudioState("ended", audio);
      commitCurrentTime(audio.currentTime, true);
      setIsPlaying(false);
      if (hasTimestampRange) {
        playFromStart(audio);
      } else {
        onPlaybackComplete?.(perspective.id);
      }
    };
    const handleError = () => {
      logAudioState("error", audio);
      setIsPlaying(false);
      if (isBenignMediaError(audio.error)) {
        return;
      }
      setPlaybackError(audio.error?.message ?? "Playback failed");
    };
    const handleLoadedMetadata = () => logAudioState("loadedmetadata", audio);
    const handleLoadedData = () => logAudioState("loadeddata", audio);
    const handleCanPlay = () => logAudioState("canplay", audio);
    const handleCanPlayThrough = () => logAudioState("canplaythrough", audio);
    const handleWaiting = () => logAudioState("waiting", audio);
    const handleStalled = () => logAudioState("stalled", audio);
    const handleSuspend = () => logAudioState("suspend", audio);

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("loadeddata", handleLoadedData);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("canplaythrough", handleCanPlayThrough);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("suspend", handleSuspend);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("loadeddata", handleLoadedData);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("canplaythrough", handleCanPlayThrough);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("suspend", handleSuspend);
    };
  }, [commitCurrentTime, hasTimestampRange, onPlaybackComplete, perspective.id, playFromStart]);

  // Throttled RAF loop for smooth currentTime updates + end-time boundary
  useEffect(() => {
    if (!isPlaying) return;
    let rafId: number | null = null;
    let lastSampleMs = 0;

    const tick = (timestamp: number) => {
      if (
        lastSampleMs === 0 ||
        timestamp - lastSampleMs >= SYNC_INTERVAL_MS
      ) {
        lastSampleMs = timestamp;
        const audio = audioRef.current;
        if (audio && Number.isFinite(audio.currentTime)) {
          if (audio.paused || audio.ended) {
            setIsPlaying(false);
            commitCurrentTime(audio.currentTime, true);
            rafId = requestAnimationFrame(tick);
            return;
          }
          // End-time boundary: loop back or stop
          if (endTime !== undefined && audio.currentTime >= endTime - 0.02) {
            if (hasTimestampRange) {
              playFromStart(audio);
            } else {
              audio.pause();
              audio.currentTime = endTime;
              commitCurrentTime(endTime, true);
              setIsPlaying(false);
              return;
            }
          } else {
            commitCurrentTime(audio.currentTime);
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [commitCurrentTime, endTime, hasTimestampRange, isPlaying, playFromStart]);

  const handleTogglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (import.meta.env.DEV) {
      console.trace("[PerspectiveListener] handleTogglePlayback intent", {
        src: audio.currentSrc || resolvedAudioSrc,
        audioPaused: audio.paused,
        stateIsPlaying: isPlaying,
        currentTime: audio.currentTime,
      });
    }

    setPlaybackError("");
    audio.muted = false;
    audio.volume = 1;

    if (!audio.paused) {
      if (import.meta.env.DEV) {
        console.trace("[PerspectiveListener] executing pause()");
      }
      audio.pause();
      return;
    }

    const resetTime = startTime ?? 0;
    if (
      audio.ended ||
      (endTime !== undefined && audio.currentTime >= endTime - 0.05) ||
      (Number.isFinite(audio.duration) &&
        audio.currentTime >= Math.max(0, audio.duration - 0.05))
    ) {
      audio.currentTime = resetTime;
      commitCurrentTime(resetTime, true);
    }
    if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      if (import.meta.env.DEV) {
        console.debug("[PerspectiveListener] forcing load() before play", {
          readyState: audio.readyState,
          networkState: audio.networkState,
        });
      }
      audio.load();
    }
    if (import.meta.env.DEV) {
      console.trace("[PerspectiveListener] executing play()");
    }
    void audio
      .play()
      .then(() => {
        if (import.meta.env.DEV) {
          console.debug("[PerspectiveListener] play() resolved");
        }
      })
      .catch((reason) => {
        logAudioState("play rejected", audio);
        setIsPlaying(false);
        if (isBenignPlaybackRejection(reason)) {
          if (import.meta.env.DEV) {
            console.warn("[PerspectiveListener] play() rejected (benign)", reason);
          }
          return;
        }
        console.error("[PerspectiveListener] play() failed", reason);
        setPlaybackError(
          reason instanceof Error ? reason.message : "Playback failed",
        );
      });
  };

  const showPlaybackError = playbackError.trim().length > 0;
  const playControlLabel = showPlaybackError
    ? "Audio unavailable"
    : isPlaying
      ? "Pause audio"
      : "Play audio";

  const parentPerspectiveId = perspective.parent_perspective_id;

  return (
    <div className="relative flex h-dvh w-full flex-col overflow-y-auto">
      <PerspectiveBackground
        imageSrc={backgroundImageSrc}
        overlayClassName="bg-black/25"
        positionClassName="fixed"
      />
      <div className="relative z-10 flex h-dvh w-full shrink-0 flex-col overflow-hidden">
        {needsPlayGesture && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
            <button
              type="button"
              onClick={() => {
                const audio = audioRef.current;
                if (!audio) return;
                seekToStart(audio);
                audio.muted = false;
                audio.volume = 1;
                void audio
                  .play()
                  .then(() => {
                    setNeedsPlayGesture(false);
                    setIsPlaying(true);
                  })
                  .catch(console.error);
              }}
              className="flex flex-col items-center gap-3 rounded-2xl border-0 bg-white/10 px-8 py-6 text-white backdrop-blur-sm touch-manipulation"
            >
              <span className="text-5xl">▶</span>
              <span className="text-sm text-white/70">Tap to play</span>
            </button>
          </div>
        )}
        <PerspectiveModeNav
          canWrite={canWrite}
          currentMode="listen"
          perspectiveId={perspective.id}
          topicName={topicName}
          parentPerspectiveId={parentPerspectiveId ?? undefined}
        />
        <div className="relative z-10 flex w-screen flex-1 min-h-0 items-center justify-center overflow-hidden [scrollbar-gutter:stable]">
          <div className="h-full w-[80vw] overflow-y-auto scrollbar-transparent">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="flex w-full flex-col items-center">
                <SWEditor
                  perspective={perspective}
                  timings={timings}
                  audioRef={audioRef}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  enablePlaybackSync
                  isActive
                  readOnly
                  showTimingLabels={false}
                />
                {(perspective.reflection_count ?? 0) > 0 && (
                  <a
                    href="#reflections"
                    className="unstyled-link mt-2 text-xs text-white/40 hover:text-white/70"
                  >
                    💭 x {perspective.reflection_count}
                  </a>
                )}
              </div>
            </div>
          </div>
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={audioRef}
            className="opacity-0 w-px h-px absolute"
            src={resolvedAudioSrc}
            preload={hasUrlTimestamp ? "metadata" : "none"}
          />
        </div>
        {showPlaybackError ? (
          <output className="px-4 pb-2 text-xs text-red-200/90">
            audio unavailable for this perspective ({playbackError})
          </output>
        ) : null}
        <div className="shrink-0 flex justify-center px-4 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button
            type="button"
            onClick={handleTogglePlayback}
            disabled={!resolvedAudioSrc}
            aria-label={playControlLabel}
            title={playControlLabel}
            className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none transition-[color,transform,width,height] duration-150 ${
              !resolvedAudioSrc
                ? "cursor-not-allowed text-white/35"
                : showPlaybackError
                  ? "text-red-100"
                  : isPlaying
                    ? "text-teal-100 text-[1rem]"
                    : "text-(--color-neon-teal-light) text-[1.2rem]"
            }`}
          >
            {showPlaybackError ? "!" : isPlaying ? "■" : "▶"}
          </button>
        </div>
      </div>
      <PerspectiveReflections
        perspective={perspective}
        topicName={topicName}
        canWrite={canWrite}
      />
    </div>
  );
};
