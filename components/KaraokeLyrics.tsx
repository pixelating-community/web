"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useOptimistic, useRef, useState } from "react";
import { Submit } from "@/components/Submit";
import { WordTime } from "@/components/WordTime";
import { addLyric } from "@/actions/addLyric";
import { editLyric } from "@/actions/editLyric";
import { deleteLyric } from "@/actions/deleteLyric";
import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";
import { findLyric } from "@/lib/findLyric";

export function KaraokeLyrics({
  trackId,
  editId,
  lyrics,
  audioSrc,
  s,
  words,
}: Readonly<{
  trackId?: string;
  editId?: string;
  lyrics: {
    id?: string;
    timestamp: string;
    text: string;
    style?: string;
    url?: string;
  }[];
  audioSrc: string;
  s?: boolean;
  words?: {
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word: string;
  }[];
}>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [timeUntilNextLyric, setTimeUntilNextLyric] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLargerScreen, setIsLargerScreen] = useState(false);
  const [isFullImmersion, setIsFullImmersion] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [lyric, setLyric] = useState("");
  const [lyricId, setLyricId] = useState("");
  const [style, setStyle] = useState("");
  const [url, setUrl] = useState("");
  const [optimisticLyric, addOptimisticLyric] = useOptimistic(lyric);
  const [optimisticLyrics, addOptimisticLyrics] = useOptimistic(
    lyrics,
    (state, newLyric) => [...state, { lyric: newLyric }]
  );
  const fullImmersionRef = useRef<HTMLButtonElement | null>(null);
  const lineRef = useRef<(HTMLButtonElement | null)[]>([]);
  const lyricRef = useRef<HTMLTextAreaElement | null>(null);
  const lastLyricTimeRef = useRef<number>(-1);
  const lastUpdateTimeRef = useRef(0);
  const MAX_LENGTH = 300;
  const MAX_ROWS = 2;

  async function formAction(formData: FormData) {
    if (!canDelete && lyric) {
      formData.append("start_at", `${currentTime}`);
      formData.append("edit_id", `${editId}`);

      if (lyricId) {
        addOptimisticLyric(lyric);
        await editLyric({ lyricId, trackId, formData });
        if (lyricRef.current) {
          lyricRef.current.value = "";
        }
        setLyricId("");
        setLyric("");
        setUrl("");
      } else {
        const formDataLyric = formData.get("lyric");
        addOptimisticLyrics(formDataLyric);
        await addLyric({ trackId, formData });
        if (lineRef.current.length - 2 === currentLineIndex) {
          setTimeout(() => {
            requestAnimationFrame(() => {
              lineRef.current[currentLineIndex + 1]?.scrollIntoView({
                behavior: "smooth",
                block: "end",
                inline: "end",
              });
            });
          }, 500);
        }
        lyricRef.current.value = "";
        setLyric("");
        setUrl("");
      }
    }

    if (canDelete && lyric === "" && lyricId) {
      await deleteLyric({ lyricId, trackId, editId });
      setLyricId("");
    }
  }

  const changeTextareaHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCanDelete(false);
    setLyric(e.target.value);

    if (e.target.value === "") {
      setCanDelete(true);
    }
  };

  const changeStyleHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStyle(e.target.value);
  };

  const changeUrlHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const updateLyricTiming = (index: number, currentSeconds: number) => {
    const currentLyricTime = parseTimestampToSeconds(lyrics[index].timestamp);
    const nextLyricTime = parseTimestampToSeconds(lyrics[index + 1]?.timestamp);

    if (lastLyricTimeRef.current !== currentLyricTime) {
      lastLyricTimeRef.current = currentLyricTime;
      setTimeUntilNextLyric(nextLyricTime - currentSeconds);
    }
  };

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || !lyrics) return;

    const currentSeconds = audioRef.current.currentTime;
    const index = findLyric(lyrics, currentSeconds);

    if (index !== currentLineIndex) {
      setCurrentLineIndex(index);
    }

    if (index >= 0 && index < lyrics.length - 1) {
      updateLyricTiming(index, currentSeconds);
    }

    if (s) {
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 100) {
        lastUpdateTimeRef.current = now;
        setCurrentTime(currentSeconds);
      }
    }
  }, [lyrics, currentLineIndex, s, updateLyricTiming]);

  useEffect(() => {
    if (!audioSrc || !audioRef.current) return;

    const audioElement = audioRef.current;
    audioElement.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [audioSrc, handleTimeUpdate]);

  useEffect(() => {
    if (currentLineIndex !== -1 && lineRef.current[currentLineIndex]) {
      lineRef.current[currentLineIndex]?.scrollIntoView({
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

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }

    setIsPlaying((prev) => !prev);
  };

  const seekForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 0.1;
    }
  };

  const seekBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 0.1;
    }
  };

  const handleFullImmersion = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const handleLyricClick = (line: {
    id?: string;
    timestamp?: string;
    text: string;
    style?: string;
    url?: string;
  }) => {
    if (audioRef.current && line.timestamp) {
      audioRef.current.currentTime = parseTimestampToSeconds(line.timestamp);
      setLyric(line.text || "");
      setLyricId(line.id || "");
      setStyle(line.style || "");
      setUrl(line.url || "");
    }
  };

  return (
    <>
      <div className="flex flex-col justify-center w-full">
        <div className="relative w-full mx-auto overflow-x-auto">
          <ul className="flex items-center w-max overflow-x-auto snap-x snap-mandatory py-8 whitespace-nowrap">
            {optimisticLyrics.map(
              (
                line: {
                  id?: string;
                  timestamp: string;
                  text: string;
                  style?: string;
                  url?: string;
                },
                index: number
              ) => {
                let animatePulseClass = "";

                if (line.style && index === currentLineIndex) {
                  if (line.style.includes("animate-pulse")) {
                    animatePulseClass = "animate-pulse";
                  }
                }

                return (
                  <li key={`${index}_${line.id}`}>
                    <button
                      onClick={() => handleLyricClick(line)}
                      ref={(el) => {
                        if (el) lineRef.current[index] = el;
                      }}
                      className={`${animatePulseClass} flex flex-col justify-center items-center`}
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
                        className={`relative sm:text-fluid text-center whitespace-pre-line px-4 max-w-[60vw] snap-center font-bold ${line.style && index === currentLineIndex ? line.style : "text-fluid"} ${index === currentLineIndex && !line.style ? "text-white text-3xl" : ""}`}
                      >
                        {line.id === lyricId ? optimisticLyric : line.text}
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
                    </button>
                  </li>
                );
              }
            )}
          </ul>
        </div>
      </div>
      {audioSrc && (
        <div className="flex flex-col justify-center w-screen p-4 items-center fixed bottom-0">
          {!isFullImmersion && isLargerScreen && !s && (
            <button
              ref={fullImmersionRef}
              onClick={handleFullImmersion}
              className="rainbow text-fluid"
            >
              ⤡
            </button>
          )}
          {s && (
            <div className="flex flex-col w-2/3 items-center relative">
              <WordTime currentTime={currentTime} words={words} />
              <form
                action={formAction}
                className="relative flex flex-col center w-full mb-2"
                autoComplete="off"
              >
                <div className="flex">
                  <input
                    data-testid="style"
                    id="style"
                    type="text"
                    placeholder="🎨"
                    className="text-xs p-2 border-0 outline-hidden dark:bg-slate-800/10 w-full"
                    name="style"
                    autoComplete="on"
                    onChange={(e) => changeStyleHandler(e)}
                    value={style || ""}
                  />
                  <input
                    data-testid="style"
                    id="url"
                    type="url"
                    placeholder="🖼️ (https://👾.ing)"
                    pattern="https://.*"
                    className="text-xs p-2 border-0 outline-hidden dark:bg-slate-800/10 w-full"
                    name="url"
                    onChange={(e) => changeUrlHandler(e)}
                    value={url || ""}
                  />
                </div>
                <div>
                  <textarea
                    ref={lyricRef}
                    data-testid="lyric"
                    id="lyric"
                    className="text-center text-fluid font-bold pt-8 border-0 outline-hidden dark:bg-slate-800/10 w-full"
                    maxLength={MAX_LENGTH}
                    rows={MAX_ROWS}
                    name="lyric"
                    onChange={(e) => changeTextareaHandler(e)}
                    value={lyric || ""}
                  />
                  <Submit
                    testid="submit"
                    btnText={`${canDelete ? "🗑️" : "🎤"}`}
                    className="absolute right-0 text-3xl p-[26px] ml-1 border-0 rounded-full"
                  />
                </div>
              </form>
            </div>
          )}
          <div className="flex justify-center w-dvw">
            {s && (
              <div className="flex">
                <button
                  className="bg-transparent rainbow lg:text-5xl"
                  onClick={seekBackward}
                >
                  {"<b"}
                </button>
              </div>
            )}
            <div className="flex flex-col items-center justify-center">
              <audio
                className={
                  s ? "mx-1 h-4" : "opacity-0 w-[1px] h-[1px] absolute"
                }
                ref={audioRef}
                src={audioSrc}
                controlsList={s ? "nodownload" : "nodownload noplaybackrate"}
                controls
                loop
              >
                <track kind="captions" srcLang="en" default />
              </audio>
              {!s && (
                <div className="flex">
                  <button
                    className="text-center rainbow text-4xl lg:text-9xl"
                    onClick={() => togglePlayPause()}
                  >
                    {isPlaying ? "□" : "▷"}
                  </button>
                </div>
              )}
            </div>
            {s && (
              <div className="flex">
                <button
                  className="bg-transparent rainbow lg:text-5xl"
                  onClick={seekForward}
                >
                  {"f>"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
