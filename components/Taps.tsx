"use client";

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
import { Tap } from "@/components/Tap";
import { Audio } from "@/components/Audio";

export const Taps = ({
  trackId,
  lyrics,
  audioSrc,
  startTime,
  endTime,
}: Readonly<{
  trackId?: string;
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
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [timeUntilNextLyric, setTimeUntilNextLyric] = useState(0);
  const currentTimeRef = useRef(0);
  const activeNotes = useRef(new Set<number>());
  const highBeatRef = useRef<{ part?: string; style?: string; tap?: string }>(
    {}
  );
  const beatRef = useRef<{ part?: string; style?: string; tap?: string }>({});
  const lowBeatRef = useRef<{ part?: string; style?: string; tap?: string }>(
    {}
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startAtRef = useRef(0);
  const lineRef = useRef<(HTMLButtonElement | null)[]>([]);
  const lastLyricTimeRef = useRef(-1);
  const [optimisticLyrics, addOptimisticLyrics] = useOptimistic(
    lyrics[0],
    (state, newLyric) => [
      ...state,
      { id: "", timestamp: "", text: newLyric as string, style: "", url: "" },
    ]
  );

  const handleHighBeat = useCallback(
    (beat: { part?: string; style?: string; tap?: string }) => {
      highBeatRef.current = { ...highBeatRef.current, ...beat };
    },
    []
  );

  const handleBeat = useCallback(
    (beat: { part?: string; style?: string; tap?: string }) => {
      beatRef.current = { ...beatRef.current, ...beat };
    },
    []
  );

  const handleLowBeat = useCallback(
    (beat: { part?: string; style?: string; tap?: string }) => {
      lowBeatRef.current = { ...lowBeatRef.current, ...beat };
    },
    []
  );

  const handleTap = useCallback(
    (note: number | string) => {
      startAtRef.current = audioRef.current?.currentTime || 0;

      if (note === 42 || note === "r") {
        const formData = new FormData();
        formData.append("start_at", `${startAtRef.current}`);
        formData.append("edit_id", `${highBeatRef.current.part || ""}`);
        formData.append("style", `${highBeatRef.current.style || ""}`);
        formData.append("lyric", `${highBeatRef.current.tap || ""}`);
        startTransition(async () => {
          if (highBeatRef.current.tap) {
            await addLyric({ trackId: trackId || "", formData });
          }
        });
      }

      if (note === 41 || note === "d") {
        const formData = new FormData();
        formData.append("start_at", `${startAtRef.current}`);
        formData.append("edit_id", `${beatRef.current.part || ""}`);
        formData.append("style", `${beatRef.current.style || ""}`);
        formData.append("lyric", `${beatRef.current.tap || ""}`);
        startTransition(async () => {
          if (beatRef.current.tap) {
            addOptimisticLyrics(beatRef.current.tap);
            await addLyric({ trackId: trackId || "", formData });
          }
        });
      }

      if (note === 40 || note === "x") {
        const formData = new FormData();
        formData.append("start_at", `${startAtRef.current}`);
        formData.append("edit_id", `${lowBeatRef.current.part || ""}`);
        formData.append("style", `${lowBeatRef.current.style || ""}`);
        formData.append("lyric", `${lowBeatRef.current.tap || ""}`);
        startTransition(async () => {
          if (lowBeatRef.current.tap) {
            await addLyric({ trackId: trackId || "", formData });
          }
        });
      }
    },
    [addOptimisticLyrics, trackId]
  );

  const handleNote = useCallback(
    ({ key, note }: { key?: string; note?: number }) => {
      switch (key || note) {
        case "r":
        case "d":
        case "x":
          handleTap(key);
          break;
        case 42:
        case 41:
        case 40:
          handleTap(note);
          break;
        default:
          break;
      }
    },
    [handleTap]
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

    currentTimeRef.current = currentSeconds;
  }, [lyrics, currentLineIndex, updateLyricTiming]);

  useEffect(() => {
    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        const handleMIDIMessage = (event: MIDIMessageEvent) => {
          const [status, note, velocity] = event.data;
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
            handleNote({ note });
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
  }, [handleNote]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleNote({ key: event.key });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTap, handleNote]);

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
              currentTime={currentTimeRef.current}
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
      />

      {lyrics.map((lyricGroup, i) => {
        if (i === 1) {
          return (
            <LyricsList
              key={lyricGroup[0]?.id || i}
              lyrics={lyricGroup}
              currentTime={currentTimeRef.current}
            />
          );
        }
        return null;
      })}
      {audioSrc && (
        <div className="flex flex-col justify-center w-screen items-center">
          <div className="flex flex-col w-full items-center relative">
            <div className="flex flex-col">
              <Tap onBeat={handleHighBeat} />
              <Tap onBeat={handleBeat} />
              <Tap onBeat={handleLowBeat} />
            </div>
            <Audio
              ref={audioRef}
              audioSrc={audioSrc}
              startTime={startTime}
              endTime={endTime}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              s
            />
          </div>
        </div>
      )}
    </>
  );
};
