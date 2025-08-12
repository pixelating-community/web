"use client";

import { startTransition, useCallback, useEffect, useRef } from "react";
import { addLyric } from "@/actions/addLyric";
import { formatTime } from "@/lib/formatTime";
import { UUID } from "crypto";

export const WordTime = ({
  words,
  addOptimisticLyricsAction,
  editId,
  audioRef,
}: {
  words?: string[];
  addOptimisticLyricsAction: (verse: string) => void;
  editId: UUID;
  audioRef: React.RefObject<HTMLAudioElement>;
}) => {
  const activeNotes = useRef(new Set<number>());
  const verseRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const startAtRef = useRef(0);

  const handlePreviousWord = useCallback(() => {
    if (indexRef.current <= 0) {
      indexRef.current = words.length - 1;
    } else {
      indexRef.current -= 1;
    }
  }, [words?.length]);

  const handleNextWord = useCallback(() => {
    if (indexRef.current < words.length) {
      indexRef.current += 1;
    } else {
      indexRef.current = 0;
    }
  }, [words?.length]);

  const handleRemoveLastWord = useCallback(() => {
    if (verseRef.current.length > 0) {
      verseRef.current.pop();
    }
  }, []);

  const handleAddWord = useCallback(() => {
    if (verseRef.current.length === 0) {
      if (audioRef.current) {
        startAtRef.current = audioRef.current.currentTime;
      }
    }
    verseRef.current.push(words[indexRef.current]);
    indexRef.current += 1;
  }, [words, audioRef]);

  const handleSaveLyric = useCallback(() => {
    const lyric = verseRef.current.join(" ");
    if (lyric.length > 0) {
      const formData = new FormData();
      formData.append("start_at", `${startAtRef.current}`);
      formData.append("edit_id", `${editId}`);
      formData.append("lyric", lyric);

      startTransition(async () => {
        addOptimisticLyricsAction(verseRef.current.join(" "));
        await addLyric({ editId, formData });
      });

      verseRef.current = [];
    }
  }, [addOptimisticLyricsAction, editId]);

  const handleNote = useCallback(
    ({ key, note }: { key?: string; note?: number }) => {
      switch (key || note) {
        case 68:
          handlePreviousWord();
          break;
        case 70:
          handleNextWord();
          break;
        case 69:
          handleRemoveLastWord();
          break;
        case 71:
          handleAddWord();
          break;
        case 72:
          handleSaveLyric();
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
    ]
  );

  useEffect(() => {
    if (navigator.requestMIDIAccess) {
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
    }
  }, [handleNote]);

  return (
    <div className="h-12 absolute top-6 opacity-25">
      {audioRef && (
        <div className="flex justify-center">
          <div className="text-white/30 text-fluid">
            {audioRef.current
              ? formatTime(audioRef.current.currentTime)
              : "0:00"}
          </div>
        </div>
      )}
      {words && (
        <>
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
        </>
      )}
    </div>
  );
};
