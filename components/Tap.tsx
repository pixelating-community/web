"use client";
/* eslint-disable @next/next/no-img-element */
import {
  startTransition,
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { addLyric } from "@/actions/addLyric";
import { findLyric } from "@/lib/findLyric";
import { parseTimestampToSeconds } from "@/lib/parseTimestampToSeconds";
import { LyricsList } from "@/components/LyricsList";
import { WriteLyricsList } from "@/components/WriteLyricsList";
import { Audio } from "@/components/Audio";

export const Tap = ({
  trackId,
  editId,
  words,
  lyrics,
  audioSrc,
  startTime,
  endTime,
}: Readonly<{
  trackId?: string;
  editId?: string;
  words?: string[];
  lyrics: {
    id?: string;
    timestamp: string;
    text: string;
    style?: string;
    url?: string;
  }[][];
  audioSrc: string;
  startTime?: number;
  endTime?: number;
}>) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const activeNotes = useRef(new Set<number>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(0);
  const verseRef = useRef<string[]>([]);
  const startAtRef = useRef(0);
  const [lyricId, setLyricId] = useState("");
  const [timeUntilNextLyric, setTimeUntilNextLyric] = useState(0);
  const lineRef = useRef<(HTMLButtonElement | null)[]>([]);
  const lastLyricTimeRef = useRef(-1);
  const [optimisticLyrics, addOptimisticLyrics] = useOptimistic(
    lyrics[0],
    (state, newLyric) => [
      ...state,
      { id: "", timestamp: "", text: newLyric as string, style: "", url: "" },
    ]
  );

  const handlePreviousWord = useCallback(() => {
    if (indexRef.current <= 0) {
      indexRef.current = words.length - 1;
    } else {
      indexRef.current -= 1;
    }
  }, [words]);

  const handleNextWord = useCallback(() => {
    if (indexRef.current < words.length) {
      indexRef.current += 1;
    } else {
      indexRef.current = 0;
    }
  }, [words]);

  const handleRemoveLastWord = useCallback(() => {
    if (verseRef.current.length > 0) {
      verseRef.current.pop();
    }
  }, []);

  const handleAddWord = useCallback(() => {
    if (verseRef.current.length === 0) {
      startAtRef.current = audioRef.current.currentTime;
    }
    verseRef.current.push(words[indexRef.current]);
    indexRef.current += 1;
  }, [words]);

  const handleSaveLyric = useCallback(() => {
    const lyric = verseRef.current.join(" ");
    if (lyric.length > 0) {
      const formData = new FormData();
      formData.append("start_at", `${startAtRef.current}`);
      formData.append("edit_id", `${editId}`);
      formData.append("lyric", lyric);

      startTransition(async () => {
        addOptimisticLyrics(verseRef.current.join(" "));
        await addLyric({ trackId, formData });
      });

      verseRef.current = [];
    }
  }, [addOptimisticLyrics, editId, trackId]);

  const handleDrum = useCallback(
    (note: number | string) => {
      const drum = "🥁";
      startAtRef.current = audioRef.current.currentTime;

      if (note === 42) {
        startTransition(async () => {
          const formData = new FormData();
          formData.append("start_at", `${startAtRef.current}`);
          formData.append("edit_id", `${editId}_`);
          formData.append("lyric", drum);
          formData.append("style", "rotate-45");
          startTransition(async () => {
            addOptimisticLyrics(drum);
            await addLyric({ trackId, formData });
          });
        });
      }
      if (note === 41 || note === "d") {
        const formData = new FormData();
        formData.append("start_at", `${startAtRef.current}`);
        formData.append("edit_id", `${editId}`);
        formData.append("lyric", drum);
        startTransition(async () => {
          addOptimisticLyrics(drum);
          await addLyric({ trackId, formData });
        });
      }
      if (note === 40) {
        const formData = new FormData();
        formData.append("start_at", `${startAtRef.current}`);
        formData.append("edit_id", `_${editId}`);
        formData.append("lyric", drum);
        formData.append("style", "rotate-90");
        startTransition(async () => {
          addOptimisticLyrics(drum);
          await addLyric({ trackId, formData });
        });
      }
    },
    [addOptimisticLyrics, editId, trackId]
  );

  const handleTap = useCallback(
    ({ key, note }: { key?: string; note?: number }) => {
      if (!audioRef.current) return;

      switch (key || note) {
        case "j":
        case 68:
          handlePreviousWord();
          break;
        case "k":
        case 70:
          handleNextWord();
          break;
        case "c":
        case 69:
          handleRemoveLastWord();
          break;
        case "v":
        case 71:
          handleAddWord();
          break;
        case "b":
        case 72:
          handleSaveLyric();
          break;
        case "d":
        case 42:
        case 41:
        case 40:
          handleDrum(note);
          break;
        default:
          break;
      }
    },
    [
      handlePreviousWord,
      handleNextWord,
      handleRemoveLastWord,
      handleAddWord,
      handleSaveLyric,
      handleDrum,
    ]
  );

  const handleLyricClick = (lyric: {
    id?: string;
    timestamp?: string;
    text: string;
    style?: string;
    url?: string;
  }) => {
    if (audioRef.current && lyric.timestamp) {
      audioRef.current.currentTime = parseTimestampToSeconds(lyric.timestamp);
      setLyricId(lyric.id || "");
    }
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
    const index = findLyric(lyrics[0], currentSeconds);

    if (index !== currentLineIndex) {
      setCurrentLineIndex(index);
    }

    if (index >= 0 && index < lyrics[0].length - 1) {
      updateLyricTiming(index, currentSeconds);
    }

    setCurrentTime(currentSeconds);
  }, [lyrics, currentLineIndex, updateLyricTiming]);

  useEffect(() => {
    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        const handleMIDIMessage = (event: MIDIMessageEvent) => {
          const [status, note, velocity] = event.data;
          console.log(event.data);
          const isNoteOn =
            (status === 144 && velocity > 0) ||
            (status === 153 && velocity > 0) ||
            (status === 185 && velocity > 0);
          const isNoteOff =
            status === 128 ||
            ((status === 144 || status === 185 || status === 137) &&
              velocity === 0);

          if (isNoteOn && !activeNotes.current.has(note)) {
            activeNotes.current.add(note);
            handleTap({ note });
          }

          if (isNoteOff) {
            activeNotes.current.delete(note);
          }
        };

        for (const input of midiAccess.inputs.values()) {
          input.addEventListener("midimessage", handleMIDIMessage);
        }

        return () => {
          for (const input of midiAccess.inputs.values()) {
            input.removeEventListener("midimessage", handleMIDIMessage);
          }
        };
      })
      .catch(console.error);
  }, [handleTap]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleTap({ key: event.key });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTap]);

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

  return (
    <>
      {lyrics.map((lyricGroup, i) => {
        if (i === 2) {
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
      />

      {lyrics.map((lyricGroup, i) => {
        if (i === 1) {
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
        <div className="flex flex-col justify-center w-screen items-center fixed bottom-0">
          <div className="flex flex-col w-full items-center relative">
            <div className="flex mb-4">
              {words
                .slice(indexRef.current, indexRef.current + 9)
                .map((word, i) => (
                  <div
                    key={`${word}-${i}`}
                    className="text-xs text-center p-2 border-0 outline-hidden dark:bg-slate-800/10"
                  >
                    {word}
                  </div>
                ))}
            </div>
            <div className="flex w-full justify-between">
              <div className="flex w-full justify-between">
                <div className="text-xs text-center p-2 border-0 outline-hidden dark:bg-slate-800/10 ">
                  {words[indexRef.current - 1]}
                </div>
                <div className="text-center p-2 border-0 outline-hidden dark:bg-slate-800/10 ">
                  <div className="text-sm text-white">
                    {verseRef.current.join(" ")}{" "}
                    <span className="text-xs text-purple-800">
                      {" "}
                      {words[indexRef.current]}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-center p-2 border-0 outline-hidden dark:bg-slate-800/10 ">
                  {words[indexRef.current + 1]}
                </div>
              </div>
            </div>
            <Audio
              ref={audioRef}
              audioSrc={audioSrc}
              startTime={startTime}
              endTime={endTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              setCurrentTime={setCurrentTime}
              s
            />
          </div>
        </div>
      )}
    </>
  );
};
