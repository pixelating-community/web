"use client";

import { useRef } from "react";

export const Tap = ({
  onBeat,
}: Readonly<{
  onBeat?: ({
    style,
    tap,
    part,
  }: {
    style?: string;
    tap?: string;
    part?: string;
  }) => void;
}>) => {
  const styleRef = useRef<HTMLInputElement>(null);
  const tapRef = useRef<HTMLInputElement>(null);
  const partRef = useRef<HTMLInputElement>(null);

  const handlePartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (partRef.current) {
      partRef.current.value = e.target.value;
      onBeat?.({ part: partRef.current?.value });
    }
  };

  const handleStyleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (styleRef.current) {
      styleRef.current.value = e.target.value;
      onBeat?.({ style: styleRef.current?.value });
    }
  };

  const handleTapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (tapRef.current) {
      tapRef.current.value = e.target.value;
      onBeat?.({ tap: tapRef.current?.value });
    }
  };

  return (
    <div className="mb-0.5">
      <input
        ref={partRef}
        data-testid="part"
        id="part"
        type="text"
        placeholder="ᵱart"
        className="text-center text-xs p-1 border-0 outline-hidden dark:bg-slate-800/10"
        name="part"
        onChange={handlePartChange}
      />
      <input
        ref={styleRef}
        data-testid="style"
        id="style"
        type="text"
        placeholder="🎨"
        className="text-center text-xs p-1 border-0 outline-hidden dark:bg-slate-800/10"
        name="style"
        onChange={handleStyleChange}
      />
      <input
        ref={tapRef}
        data-testid="tap"
        id="tap"
        type="text"
        placeholder="♩"
        className="text-center text-xs p-1 border-0 outline-hidden dark:bg-slate-800/10"
        name="tap"
        onChange={handleTapChange}
      />
    </div>
  );
};
