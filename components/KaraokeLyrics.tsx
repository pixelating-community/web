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
import { LyricsList } from "@/components/LyricsList";
import { WriteLyricsList } from "@/components/WriteLyricsList";
import { Audio } from "@/components/Audio";

export const KaraokeLyrics = ({
  trackId,
  editId,
  lyrics,
  audioSrc,
  s,
  words,
  startTime,
  endTime,
}: Readonly<{
  trackId?: string;
  editId?: string;
  lyrics: {
    id?: string;
    timestamp: string;
    text: string;
    style?: string;
    url?: string;
  }[][];
  audioSrc: string;
  s?: boolean;
  words?: string[];
  startTime?: number;
  endTime?: number;
}>) => {
  const [studio] = useState(s);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState<number>(-1);
  const [timeUntilNextLyric, setTimeUntilNextLyric] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isLargerScreen, setIsLargerScreen] = useState(false);
  const [isFullImmersion, setIsFullImmersion] = useState(false);
  const [lyric, setLyric] = useState("");
  const [lyricId, setLyricId] = useState("");
  const [style, setStyle] = useState("");
  const [url, setUrl] = useState("");
  const [optimisticLyric, addOptimisticLyric] = useOptimistic(lyric);
  const [optimisticLyrics, addOptimisticLyrics] = useOptimistic(
    lyrics[0],
    (state, newLyric) => [
      ...state,
      { id: "", timestamp: "", text: newLyric as string, style: "", url: "" },
    ]
  );
  const fullImmersionRef = useRef<HTMLButtonElement | null>(null);
  const lineRef = useRef<(HTMLButtonElement | null)[]>([]);
  const lyricRef = useRef<HTMLTextAreaElement | null>(null);
  const lastLyricTimeRef = useRef<number>(-1);
  const lastUpdateTimeRef = useRef(0);
  const MAX_LENGTH = 300;
  const MAX_ROWS = 2;

  async function formAction(formData: FormData) {
    if (lyric) {
      formData.append("start_at", `${audioRef.current.currentTime}`);
      formData.append("edit_id", `${editId}`);

      if (lyricId) {
        addOptimisticLyric(lyric);
        await editLyric({ lyricId, trackId, formData });
        resetLyricForm();
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
          }, 100);
        }
      }
    }
  }

  const resetLyricForm = () => {
    if (lyricRef.current) {
      lyricRef.current.value = "";
    }
    setLyricId("");
    setLyric("");
    setUrl("");
  };

  const changeTextareaHandler = async (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setLyric(e.target.value);
  };

  const deleteLyricHandler = async () => {
    if (lyric !== "") {
      await deleteLyric({ lyricId, trackId, editId });
      resetLyricForm();
    }
  };

  const changeStyleHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStyle(e.target.value);
  };

  const changeUrlHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const updateLyricTiming = useCallback(
    (index: number, currentSeconds: number) => {
      const currentLyricTime = parseTimestampToSeconds(
        lyrics[0][index].timestamp
      );
      const nextLyricTime = parseTimestampToSeconds(
        lyrics[0][index + 1]?.timestamp
      );

      if (lastLyricTimeRef.current !== currentLyricTime) {
        lastLyricTimeRef.current = currentLyricTime;
        setTimeUntilNextLyric(nextLyricTime - currentSeconds);
      }
    },
    [lyrics]
  );

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || !lyrics[0]) return;

    const currentSeconds = audioRef.current.currentTime;
    setCurrentTime(currentSeconds);
    const index = findLyric(lyrics[0], currentSeconds);

    if (index !== currentLineIndex) {
      setCurrentLineIndex(index);
    }

    if (index >= 0 && index < lyrics[0].length - 1) {
      updateLyricTiming(index, currentSeconds);
    }

    if (s) {
      const now = Date.now();
      if (now - lastUpdateTimeRef.current > 100) {
        lastUpdateTimeRef.current = now;
      }
    }
  }, [lyrics, currentLineIndex, s, updateLyricTiming]);

  const handleFullImmersion = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

  const handleLyricClick = (lyric: {
    id?: string;
    timestamp?: string;
    text: string;
    style?: string;
    url?: string;
  }) => {
    if (audioRef.current && lyric.timestamp) {
      audioRef.current.currentTime = parseTimestampToSeconds(lyric.timestamp);
      setLyric(lyric.text || "");
      setLyricId(lyric.id || "");
      setStyle(lyric.style || "");
      setUrl(lyric.url || "");
    }
  };

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

  return (
    <>
      {lyrics.map((lyricGroup, i) => {
        if (i === 2 && lyrics.length === 3) {
          return (
            <LyricsList
              key={lyricGroup[0]?.id || i}
              lyrics={lyricGroup}
              currentTime={audioRef.current ? audioRef.current.currentTime : 0}
            />
          );
        }
        return null;
      })}
      {lyrics.map((lyricGroup, i) => {
        if (i === 1 && lyrics.length === 2) {
          return (
            <LyricsList
              key={lyricGroup[0]?.id || i}
              lyrics={lyricGroup}
              currentTime={currentTime}
            />
          );
        }
        return null;
      })}
      <WriteLyricsList
        lyrics={optimisticLyrics}
        currentLineIndex={currentLineIndex}
        handleLyricClick={handleLyricClick}
        lineRef={lineRef}
        timeUntilNextLyric={timeUntilNextLyric}
        lyricId={lyricId}
        optimisticLyric={optimisticLyric}
      />
      {lyrics.map((lyricGroup, i) => {
        if (i === 1 && lyrics.length === 3) {
          return (
            <LyricsList
              key={lyricGroup[0]?.id || i}
              lyrics={lyricGroup}
              currentTime={currentTime}
            />
          );
        }
        return null;
      })}
      {audioSrc && (
        <div className="flex flex-col justify-center w-screen items-center">
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
              <WordTime
                audioRef={audioRef}
                words={words}
                trackId={trackId}
                editId={editId}
                addOptimisticLyricsAction={addOptimisticLyrics}
              />
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
                    placeholder="🖼️"
                    pattern="https://.*"
                    className="text-xs p-2 border-0 outline-hidden dark:bg-slate-800/10 w-full"
                    name="url"
                    onChange={(e) => changeUrlHandler(e)}
                    value={url || ""}
                  />
                </div>
                <div className="flex">
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

                  <div className="flex flex-col justify-between dark:bg-slate-800/10">
                    <Submit
                      testid="submit"
                      btnText="🎤"
                      className="text-3xl p-[26px] border-0"
                    />
                    {lyric !== "" && (
                      <button className="p-2" onClick={deleteLyricHandler}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}
          <Audio
            ref={audioRef}
            audioSrc={audioSrc}
            startTime={startTime}
            endTime={endTime}
            isPlaying={isPlaying}
            setIsPlaying={setIsPlaying}
            playbackRate={playbackRate}
            setPlaybackRate={setPlaybackRate}
            s={studio}
          />
        </div>
      )}
    </>
  );
};
