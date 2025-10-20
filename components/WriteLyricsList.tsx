import type { UUID } from "node:crypto";
import { useMemo } from "react";
import { Video } from "@/components/Video";
import { WordGradientSVG } from "@/components/WordGradientSVG";

export const WriteLyricsList = ({
  lyrics,
  currentLineIndex,
  handleLyricClick,
  lineRef,
  timeUntilNextLyric,
  lyricId,
  optimisticLyric,
  font,
}: {
  lyrics: {
    id?: UUID;
    timestamp: number;
    lyric: string;
    style?: string;
    url?: string;
  }[];
  currentLineIndex: number;
  handleLyricClick: (line: {
    id?: UUID;
    timestamp: number;
    lyric: string;
    style?: string;
    url?: string;
  }) => void;
  lineRef: React.RefObject<(HTMLButtonElement | null)[]>;
  timeUntilNextLyric: number;
  lyricId?: string;
  optimisticLyric?: string;
  font?: string;
}) => {
  const currentLineUrl = useMemo(() => {
    if (lyrics) {
      const line = lyrics[currentLineIndex];
      return line?.url?.endsWith(".webm") ? line.url : null;
    }
    return;
  }, [lyrics, currentLineIndex]);
  return (
    <>
      <Video url={currentLineUrl} />
      <div className="relative w-full mx-auto overflow-x-auto scrollbar-transparent overflow-y-visible">
        <ul className="flex items-center w-max snap-x snap-mandatory py-8 whitespace-nowrap">
          {lyrics.map((line, index) => {
            const animatePulseClass =
              line.style &&
              index === currentLineIndex &&
              line.style.includes("animate-pulse")
                ? "animate-pulse"
                : "";
            const fontClass = font ? `font-${font}` : "";

            return (
              <li key={`${index}_${line.id}`}>
                <button
                  type="button"
                  onClick={() => handleLyricClick(line)}
                  ref={(el) => {
                    if (el) {
                      if (!lineRef.current) {
                        lineRef.current = [];
                      }
                      lineRef.current[index] = el;
                    }
                  }}
                  className={`${animatePulseClass} ${fontClass} flex flex-col justify-center items-center relative overflow-visible`}
                >
                  {line.url && !line.url.endsWith(".webm") && (
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
                    {(() => {
                      const displayText =
                        line.id === lyricId ? optimisticLyric : line.lyric;
                      return line.style === "text-gradient" &&
                        index === currentLineIndex ? (
                        <WordGradientSVG
                          text={displayText}
                          fontSize={72}
                          gradientStops={[
                            { offset: "0%", color: "#ec4899" },
                            { offset: "100%", color: "#facc15" },
                          ]}
                        />
                      ) : (
                        displayText
                      );
                    })()}
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
    </>
  );
};
