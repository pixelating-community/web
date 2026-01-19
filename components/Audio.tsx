"use client";

import { forwardRef, useCallback, useEffect, useState } from "react";

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1];

type AudioProps = {
  src: string;
  startTime?: number;
  endTime?: number;
  studio?: boolean;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  loop?: boolean;
  onTimeUpdate?: (time: number) => void;
};

export const Audio = forwardRef<HTMLAudioElement, AudioProps>(
  (
    {
      src,
      startTime,
      endTime,
      studio,
      isPlaying,
      setIsPlaying,
      loop = true,
      onTimeUpdate,
    },
    ref,
  ) => {
    const audioRef = ref as React.RefObject<HTMLAudioElement>;
    const [playbackRate, setPlaybackRate] = useState(1);

    const cyclePlaybackRate = useCallback(() => {
      setPlaybackRate((prev) => {
        const currentIndex = Math.max(PLAYBACK_RATES.indexOf(prev), 0);
        const nextRate =
          PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
        if (audioRef?.current) {
          audioRef.current.playbackRate = nextRate;
        }
        return nextRate;
      });
    }, [audioRef]);

    const handleTimeUpdate = useCallback(() => {
      if (!audioRef?.current) return;
      const audio = audioRef.current;
      const currentSeconds = audio.currentTime;
      const playing = !audio.paused;

      if (playing !== isPlaying) {
        setIsPlaying(playing);
      }
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
      isPlaying,
      setIsPlaying,
      startTime,
      endTime,
      loop,
      onTimeUpdate,
    ]);

    useEffect(() => {
      if (!src || !audioRef?.current) return;
      const audio = audioRef.current;
      audio.addEventListener("loadedmetadata", handleTimeUpdate);
      return () =>
        audio.removeEventListener("loadedmetadata", handleTimeUpdate);
    }, [src, handleTimeUpdate, audioRef]);

    useEffect(() => {
      if (audioRef?.current) {
        audioRef.current.playbackRate = playbackRate;
      }
    }, [audioRef, playbackRate]);

    const togglePlayPause = () => {
      if (!audioRef?.current) return;
      if (isPlaying) {
        setIsPlaying(false);
        audioRef.current.pause();
      } else {
        setIsPlaying(true);
        audioRef.current.play();
      }
    };

    const seekForward = () => {
      if (audioRef?.current) audioRef.current.currentTime += 0.05;
    };

    const seekBackward = () => {
      if (audioRef?.current) audioRef.current.currentTime -= 0.05;
    };

    return (
      <div className="flex w-full items-center justify-center gap-4">
        {studio && (
          <button
            type="button"
            className="block bg-transparent text-[2rem] p-4 mb-1.5 touch-manipulation select-none border-0 rounded-none"
            onClick={seekBackward}
          >
            {"◅"}
          </button>
        )}
        <div className="flex flex-col items-center justify-center">
          <audio
            className="opacity-0 w-[1px] h-[1px] absolute"
            ref={ref}
            src={src}
            controlsList="nodownload noplaybackrate"
            loop={loop}
            autoPlay={loop}
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
          >
            <track kind="captions" srcLang="en" default />
          </audio>
          {studio && (
            <button
              type="button"
              className="text-center rainbow text-[1rem] lg:text-[2rem] touch-manipulation select-none border-0 bg-transparent rounded-none"
              onClick={cyclePlaybackRate}
            >
              x{playbackRate}
            </button>
          )}
          {studio && (
            <input
              type="range"
              className="w-full appearance-none bg-gray-300 h-2 rounded-lg accent-[#6e11b0]"
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
              style={{
                background: `linear-gradient(to right, #6e11b0 0%, #6e11b0 ${
                  ((audioRef?.current?.currentTime || 0) /
                    (endTime || audioRef?.current?.duration || 1)) *
                  100
                }%, #d1d5db ${
                  ((audioRef?.current?.currentTime || 0) /
                    (endTime || audioRef?.current?.duration || 1)) *
                  100
                }%, #d1d5db 100%)`,
              }}
            />
          )}
          <button
            type="button"
            className="text-center rainbow text-[2rem] lg:text-[4rem] touch-manipulation select-none border-0 bg-transparent rounded-none"
            onClick={togglePlayPause}
          >
            {isPlaying ? "□" : "▷"}
          </button>
        </div>
        {studio && (
          <button
            type="button"
            className="block bg-transparent text-[2rem] p-4 mb-1.5 touch-manipulation select-none border-0 rounded-none"
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
