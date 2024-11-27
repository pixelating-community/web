"use client";

import React, { useState, useEffect, useRef } from "react";

const parseTimestampToSeconds = (timestamp: string): number => {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return minutes * 60 + seconds;
};

const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time % 1) * 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
};

const findLyricIndexByTime = (
  lyrics: { timestamp: string; text: string }[],
  currentSeconds: number
): number => {
  const BUFFER = 0.2;

  for (let i = 0; i < lyrics.length; i++) {
    const currentLyricTime = parseTimestampToSeconds(lyrics[i].timestamp);
    const nextLyricTime =
      i + 1 < lyrics.length
        ? parseTimestampToSeconds(lyrics[i + 1].timestamp)
        : Infinity;

    if (
      currentSeconds >= currentLyricTime - BUFFER &&
      currentSeconds < nextLyricTime - BUFFER
    ) {
      return i;
    }
  }

  return -1;
};

export function KaraokeLyrics({
  lyrics,
  audioSrc,
  s,
}: {
  lyrics: { timestamp: string; text: string; style?: string }[];
  audioSrc: string;
  s?: boolean;
}) {
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [timeUntilNextLyric, setTimeUntilNextLyric] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLargerScreen, setIsLargerScreen] = useState(false);
  const [isFullImmersion, setIsFullImmersion] = useState(false);
  const fullImmersionRef = useRef<HTMLButtonElement | null>(null);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  const lastLyricTimeRef = useRef<number>(-1);
  const lastUpdateTimeRef = useRef(0);

  useEffect(() => {
    const handleTimeUpdate = () => {
      if (audioRef.current && lyrics) {
        const currentSeconds = audioRef.current.currentTime;
        const index = findLyricIndexByTime(lyrics, currentSeconds);
        setCurrentLineIndex(index);

        if (index !== -1 && index + 1 < lyrics.length) {
          const currentLyricTime = parseTimestampToSeconds(
            lyrics[index].timestamp
          );
          const nextLyricTime = parseTimestampToSeconds(
            lyrics[index + 1].timestamp
          );
          const timeDifference = nextLyricTime - currentSeconds;

          if (lastLyricTimeRef.current !== currentLyricTime) {
            lastLyricTimeRef.current = currentLyricTime;
            setTimeUntilNextLyric(timeDifference);
          }
        }
        if (s) {
          const now = Date.now();
          if (now - lastUpdateTimeRef.current > 200) {
            lastUpdateTimeRef.current = now;
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }
        }
      }
    };

    if (audioSrc && audioRef.current) {
      const audioElement = audioRef.current;
      audioElement.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }
  }, [audioSrc, lyrics, s]);

  useEffect(() => {
    if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex]) {
      lineRefs.current[currentLineIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentLineIndex]);

  useEffect(() => {
    const smallScreenQuery = window.matchMedia("(max-width: 768px)");
    const detectDevice = () => {
      setIsLargerScreen(!smallScreenQuery.matches);
    };
    const onFullImmersionChange = () => {
      setIsFullImmersion(!!document.fullscreenElement);
    };

    detectDevice();
    smallScreenQuery.addEventListener("change", detectDevice);
    document.addEventListener("fullscreenchange", onFullImmersionChange);

    return () => {
      smallScreenQuery.removeEventListener("change", detectDevice);
      document.removeEventListener("fullscreenchange", onFullImmersionChange);
    };
  }, []);

  const seekForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 0.5;
    }
  };

  const seekBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 0.5;
    }
  };

  const handleFullImmersion = () => {
    document.body.requestFullscreen();
  };

  return (
    <>
      <div className="flex flex-col justify-center w-full">
        <div className="relative w-full mx-auto overflow-x-auto">
          <ul
            className="flex items-center w-max overflow-x-auto snap-x snap-mandatory py-8"
            style={{ whiteSpace: "nowrap" }}
          >
            {lyrics.map((line, index) => (
              <li
                ref={(el) => {
                  lineRefs.current[index] = el;
                }}
                key={index}
                className={`${line.style && index === currentLineIndex && !line.style.includes("animate-pulse") ? `animate-pulse` : ""}${line.style && index === currentLineIndex && line.style.includes("animate-pulse") ? `animate-pulse` : ""}`}
              >
                <span
                  className={`relative text-fluid text-center whitespace-pre-line px-4 max-w-[60vw] snap-center ${index === currentLineIndex && !line.style ? "font-bold text-white text-3xl " : ""}${line.style && index === currentLineIndex ? `${line.style}` : ""} font-bold`}
                >
                  {line.text}
                  {index === currentLineIndex &&
                    line.text !== "1" &&
                    line.text !== "2" &&
                    line.text !== "3" &&
                    line.text !== "4" &&
                    line.text !== "5" && (
                      <span
                        className="absolute inset-0 text-red-500 overflow-hidden text-shadow bg-purple-500/40"
                        style={{
                          animation: `run-text ${timeUntilNextLyric}s linear forwards`,
                        }}
                      ></span>
                    )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {audioSrc && (
        <div className="flex flex-col justify-center w-screen p-4 fixed bottom-1 items-center">
          {!isFullImmersion && isLargerScreen && (
            <button ref={fullImmersionRef} onClick={handleFullImmersion}>
              🗖
            </button>
          )}
          {s && (
            <div className="flex">
              <div className="rainbow text-3xl">{formatTime(currentTime)}</div>
            </div>
          )}
          <div className="flex justify-around w-dvw">
            {s && (
              <div className="flex">
                <button
                  className="bg-transparent rainbow"
                  onClick={seekBackward}
                >
                  {"<< b"}
                </button>
              </div>
            )}
            <audio
              className="bg-transparent"
              ref={audioRef}
              src={audioSrc}
              controlsList="nodownload noplaybackrate"
              controls
              loop
            />
            {s && (
              <div className="flex">
                <button
                  className="bg-transparent rainbow"
                  onClick={seekForward}
                >
                  {"f >>"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
