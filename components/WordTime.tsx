"use client";

import { formatTime } from "@/lib/formatTime";

export const WordTime = ({
  currentTime,
  words,
}: {
  currentTime: number;
  words?: {
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word: string;
  }[];
}) => {
  return (
    <div className="h-12 absolute top-6">
      <div className="text-white/30 text-fluid">{formatTime(currentTime)}</div>
      {words && (
        <div className="text-fluid text-center leading-relaxed opacity-10 mt-8">
          {words.map((word, index) => {
            const isActive =
              currentTime >= word.start && currentTime <= word.end;

            return (
              <span
                key={index}
                className={`px-1 ${
                  isActive ? "font-bold text-white text-fluid" : "hidden"
                }`}
              >
                {word.punctuated_word}{" "}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
