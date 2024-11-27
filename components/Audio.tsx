import React, { useEffect, useCallback } from "react";

export const Audio = ({
  audioSrc,
  startTime,
  endTime,
  s,
  isPlaying,
  setIsPlaying,
  setCurrentTime,
  ref,
}: {
  audioSrc: string;
  startTime?: number;
  endTime?: number;
  s?: boolean;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  ref: React.RefObject<HTMLAudioElement>;
}) => {
  const handleTimeUpdate = useCallback(() => {
    if (!ref.current) return;

    const currentSeconds = ref.current.currentTime;
    if (
      startTime &&
      endTime &&
      (currentSeconds >= endTime || currentSeconds < startTime)
    ) {
      ref.current.pause();
      ref.current.currentTime = startTime;
      setCurrentTime(startTime);
      ref.current.play();
    }
  }, [ref, startTime, endTime, setCurrentTime]);

  useEffect(() => {
    if (!audioSrc || !ref.current) return;

    const audioElement = ref.current;

    audioElement.addEventListener("loadedmetadata", handleTimeUpdate);
    audioElement.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audioElement.removeEventListener("loadedmetadata", handleTimeUpdate);
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [ref, audioSrc, handleTimeUpdate, startTime]);

  const togglePlayPause = () => {
    if (!ref.current) return;

    if (isPlaying) {
      ref.current.pause();
    } else {
      ref.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  const seekForward = () => {
    if (ref.current) {
      ref.current.currentTime += 0.1;
    }
  };

  const seekBackward = () => {
    if (ref.current) {
      ref.current.currentTime -= 0.1;
    }
  };

  return (
    <div className="flex justify-center w-2/3">
      {s && (
        <div className="flex justify-center">
          <button
            className="block bg-transparent text-white text-[2rem] p-4 mb-1.5 touch-manipulation select-none"
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
          controls
          loop
          preload="auto"
          autoPlay
        >
          <track kind="captions" srcLang="en" default />
        </audio>
        {!s && (
          <div className="flex">
            <button
              className="text-center rainbow text-[2rem] lg:text-[4rem] touch-manipulation select-none"
              onClick={togglePlayPause}
            >
              {isPlaying ? "□" : "▷"}
            </button>
          </div>
        )}
      </div>
      {s && (
        <div className="flex justify-center">
          <button
            className="block bg-transparent text-white text-[2rem] p-4 mb-1.5 touch-manipulation select-none"
            onClick={seekForward}
          >
            {"▻"}
          </button>
        </div>
      )}
    </div>
  );
};
