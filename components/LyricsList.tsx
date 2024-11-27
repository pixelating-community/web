/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { findLyric } from "@/lib/findLyric";
import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";

export const LyricsList = ({
  lyrics,
  currentTime,
}: {
  lyrics: {
    id?: string;
    timestamp: string;
    lyric: string;
    style?: string;
    url?: string;
  }[];
  currentTime: number;
}) => {
  const lineRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [timeUntilNextLyric, setTimeUntilNextLyric] = useState(0);

  const index = findLyric(lyrics, currentTime);

  if (index !== currentLineIndex) {
    setCurrentLineIndex(index);
    if (index + 1 < lyrics.length) {
      const nextLyricTime = parseTimestampToSeconds(
        lyrics[index + 1]?.timestamp
      );
      setTimeUntilNextLyric(nextLyricTime - currentTime);
    }
  }

  if (currentLineIndex !== -1 && lineRef.current[currentLineIndex]) {
    lineRef.current[currentLineIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  return (
    <div className="relative w-full mx-auto overflow-x-auto scrollbar-transparent">
      <ul className="flex items-center w-max snap-x snap-mandatory py-8 whitespace-nowrap">
        {lyrics.map((line, index) => {
          let animatePulseClass = "";

          if (line.style && index === currentLineIndex) {
            if (line.style.includes("animate-pulse")) {
              animatePulseClass = "animate-pulse";
            }
          }

          return (
            <li key={`${index}_${line.id}`}>
              <button
                ref={(el) => {
                  if (el) {
                    if (!lineRef.current) {
                      lineRef.current = [];
                    }
                    lineRef.current[index] = el;
                  }
                }}
                className={`${animatePulseClass} flex flex-col justify-center items-center relative`}
              >
                {line.url && (
                  <div className="max-h-96 max-w-80 lg:max-w-96">
                    <img
                      src={line.url}
                      alt=""
                      className="object-contain max-h-48 max-w-80"
                    />
                  </div>
                )}
                <span
                  className={`relative sm:text-fluid leading-none text-center whitespace-pre-line px-4 snap-center font-bold ${
                    line.style && index === currentLineIndex
                      ? line.style
                      : "text-fluid"
                  } ${
                    index === currentLineIndex && !line.style
                      ? "text-white text-3xl"
                      : ""
                  }`}
                >
                  {line.lyric}
                  {index === currentLineIndex &&
                    line.lyric !== "1" &&
                    line.lyric !== "2" &&
                    line.lyric !== "3" &&
                    line.lyric !== "4" &&
                    line.lyric !== "5" && (
                      <span
                        className="absolute inset-0 text-red-500 overflow-hidden text-shadow bg-purple-500/40"
                        style={{
                          animation: `run-text ${timeUntilNextLyric}s linear forwards`,
                        }}
                      ></span>
                    )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
