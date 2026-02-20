"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PerspectiveModeNav } from "@/components/PerspectiveModeNav";
import { SWEditor } from "@/components/SWEditor";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";
import type { Perspective } from "@/types/perspectives";

type PerspectiveListenerProps = {
  perspective: Perspective;
  topicName: string;
  canWrite?: boolean;
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

export const PerspectiveListener = ({
  perspective,
  topicName,
  canWrite = false,
  onPlaybackComplete,
}: PerspectiveListenerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackError, setPlaybackError] = useState<string>("");
  const timings = perspective.wordTimings ?? [];
  const resolvedAudioSrc = useMemo(
    () => resolvePublicAudioSrc(perspective.audio_src),
    [perspective.audio_src],
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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlaying = () => {
      logAudioState("playing", audio);
      setPlaybackError("");
      setCurrentTime(audio.currentTime);
      setIsPlaying(true);
    };
    const handlePause = () => {
      logAudioState("pause", audio);
      setCurrentTime(audio.currentTime);
      setIsPlaying(false);
    };
    const handleEnded = () => {
      logAudioState("ended", audio);
      setCurrentTime(audio.currentTime);
      setIsPlaying(false);
      onPlaybackComplete?.(perspective.id);
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
  }, [onPlaybackComplete, perspective.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncCurrentTime = () => {
      setCurrentTime(audio.currentTime);
    };

    syncCurrentTime();
    audio.addEventListener("timeupdate", syncCurrentTime);
    audio.addEventListener("loadedmetadata", syncCurrentTime);
    audio.addEventListener("loadeddata", syncCurrentTime);
    audio.addEventListener("seeked", syncCurrentTime);
    audio.addEventListener("emptied", syncCurrentTime);

    return () => {
      audio.removeEventListener("timeupdate", syncCurrentTime);
      audio.removeEventListener("loadedmetadata", syncCurrentTime);
      audio.removeEventListener("loadeddata", syncCurrentTime);
      audio.removeEventListener("seeked", syncCurrentTime);
      audio.removeEventListener("emptied", syncCurrentTime);
    };
  }, [resolvedAudioSrc]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        setCurrentTime(audio.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying]);

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

    if (
      audio.ended ||
      (Number.isFinite(audio.duration) &&
        audio.currentTime >= Math.max(0, audio.duration - 0.05))
    ) {
      audio.currentTime = 0;
      setCurrentTime(0);
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
  const leadingControl = (
    <div className="inline-flex">
      <button
        type="button"
        onClick={handleTogglePlayback}
        disabled={!resolvedAudioSrc}
        aria-label={
          showPlaybackError
            ? "Audio unavailable"
            : isPlaying
              ? "Pause audio"
              : "Play audio"
        }
        title={
          showPlaybackError
            ? "Audio unavailable"
            : isPlaying
              ? "Pause audio"
              : "Play audio"
        }
        className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none transition-[color,transform,width,height] duration-150 ${
          !resolvedAudioSrc
            ? "cursor-not-allowed text-white/30"
            : showPlaybackError
              ? "text-red-200"
              : isPlaying
                ? "text-teal-200 text-[1rem]"
                : "text-(--color-neon-teal) text-[1.2rem]"
        }`}
      >
        {showPlaybackError ? "!" : isPlaying ? "■" : "▶"}
      </button>
    </div>
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <PerspectiveModeNav
        canWrite={canWrite}
        currentMode="listen"
        perspectiveId={perspective.id}
        topicName={topicName}
      />
      <div className="flex w-screen flex-1 min-h-0 items-center justify-center overflow-hidden px-4 py-4">
        <div className="flex h-full w-full max-w-5xl items-center justify-center">
          <div className="w-full">
            <SWEditor
              perspective={perspective}
              timings={timings}
              audioRef={audioRef}
              currentTime={currentTime}
              isPlaying={isPlaying}
              enablePlaybackSync
              allowWordSeek={false}
              isActive
              readOnly
              showTimingLabels={false}
              showSelection={false}
              leadingControl={leadingControl}
            />
          </div>
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            ref={audioRef}
            className="opacity-0 w-px h-px absolute"
            src={resolvedAudioSrc}
            preload="none"
          />
        </div>
      </div>
      {showPlaybackError ? (
        <output className="px-4 pb-2 text-xs text-red-200/90">
          audio unavailable for this perspective ({playbackError})
        </output>
      ) : null}
    </div>
  );
};
