import React, { useEffect, useCallback } from "react";

export const Audio = ({
  audioSrc,
  startTime,
  endTime,
  s,
  isPlaying,
  setIsPlaying,
  playbackRate,
  setPlaybackRate,
  ref,
  norepeat,
}: {
  audioSrc: string;
  startTime?: number;
  endTime?: number;
  s?: boolean;
  isPlaying?: boolean;
  setIsPlaying?: (isPlaying: boolean) => void;
  playbackRate?: number;
  setPlaybackRate?: (playbackRate: number) => void;
  ref: React.RefObject<HTMLAudioElement>;
  norepeat?: boolean;
}) => {
  const handleTimeUpdate = useCallback(() => {
    if (!ref.current) return;

    if (ref.current.paused) {
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
    }

    const currentSeconds = ref.current.currentTime;
    if (
      startTime &&
      endTime &&
      (currentSeconds >= endTime || currentSeconds < startTime)
    ) {
      ref.current.pause();
      ref.current.currentTime = startTime;
      if (!norepeat) {
        ref.current.play();
      }
    }
  }, [ref, setIsPlaying, startTime, endTime, norepeat]);

  useEffect(() => {
    if (!audioSrc || !ref.current) return;

    const audioElement = ref.current;

    audioElement.addEventListener("loadedmetadata", handleTimeUpdate);

    return () => {
      audioElement.removeEventListener("loadedmetadata", handleTimeUpdate);
    };
  }, [ref, audioSrc, handleTimeUpdate, startTime]);

  const togglePlayPause = () => {
    if (!ref.current) return;

    if (isPlaying) {
      setIsPlaying(false);
      ref.current.pause();
    } else {
      setIsPlaying(true);
      ref.current.play();
    }
  };

  const seekForward = () => {
    if (ref.current) {
      ref.current.currentTime += 0.05;
    }
  };

  const seekBackward = () => {
    if (ref.current) {
      ref.current.currentTime -= 0.05;
    }
  };

  return (
    <div className="flex justify-center w-2/3">
      {s && (
        <div className="flex justify-center">
          <button
            className="block bg-transparent text-[2rem] p-4 mb-1.5 touch-manipulation select-none"
            onClick={seekBackward}
          >
            {"◅"}
          </button>
        </div>
      )}
      <div className="flex flex-col items-center justify-center">
        <audio
          className={s ? "h-4 w-3xs" : "opacity-0 w-[1px] h-[1px] absolute"}
          ref={ref}
          src={audioSrc}
          controlsList={s ? "nodownload" : "nodownload noplaybackrate"}
          loop={!norepeat}
          autoPlay={!norepeat}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
        >
          <track kind="captions" srcLang="en" default />
        </audio>
        {s && (
          <>
            <button
              className="text-center rainbow text-[1rem] lg:text-[2rem] touch-manipulation select-none"
              onClick={() => {
                if (ref.current) {
                  const currentRate = ref.current.playbackRate;
                  if (currentRate === 0.25) {
                    ref.current.playbackRate = 0.5;
                  } else if (currentRate === 0.5) {
                    ref.current.playbackRate = 1;
                  } else {
                    ref.current.playbackRate = 0.25;
                  }

                  setPlaybackRate(ref.current.playbackRate);
                }
              }}
            >
              x{playbackRate}
            </button>
            <input
              type="range"
              className="w-full appearance-none bg-gray-300 h-1 rounded-lg accent-[#6e11b0]"
              min={startTime || 0}
              max={endTime || ref.current?.duration || 0}
              step="0.1"
              value={ref.current?.currentTime || 0}
              onChange={(e) => {
                if (ref.current) {
                  ref.current.currentTime = parseFloat(e.target.value);
                }
              }}
              style={{
                background: `linear-gradient(to right, #6e11b0 0%, #6e11b0 ${
                  ((ref.current?.currentTime || 0) /
                    (endTime || ref.current?.duration || 1)) *
                  100
                }%, #6e11b0 ${
                  ((ref.current?.currentTime || 0) /
                    (endTime || ref.current?.duration || 1)) *
                  100
                }%, #6e11b0 100%)`,
              }}
            />
          </>
        )}
        <div className="flex">
          <button
            className="text-center rainbow text-[2rem] lg:text-[4rem] touch-manipulation select-none"
            onClick={togglePlayPause}
          >
            {isPlaying ? "□" : "▷"}
          </button>
        </div>
      </div>
      {s && (
        <div className="flex justify-center">
          <button
            className="block bg-transparent text-[2rem] p-4 mb-1.5 touch-manipulation select-none"
            onClick={seekForward}
          >
            {"▻"}
          </button>
        </div>
      )}
    </div>
  );
};
