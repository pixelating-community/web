"use client";

import type { RefObject } from "react";
import { SWEditor } from "@/components/SWEditor";
import type { SWSurfaceItem } from "@/components/sw/types";

type SWStudioSurfaceProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  highlightDurationScale?: number;
  isPlaying: boolean;
  items: SWSurfaceItem[];
  onSeek: (time: number) => void;
  onSelectWord: (perspectiveId: string, index: number) => void;
  registerPerspectiveRef: (
    perspectiveId: string,
    node: HTMLDivElement | null,
  ) => void;
};

export const SWStudioSurface = ({
  audioRef,
  highlightDurationScale,
  isPlaying,
  items,
  onSeek,
  onSelectWord,
  registerPerspectiveRef,
}: SWStudioSurfaceProps) => {
  return items.map((item) => (
    <div
      key={item.perspective.id}
      ref={(node) => {
        registerPerspectiveRef(item.perspective.id, node);
      }}
      data-id={item.perspective.id}
      className="defer-offscreen h-full min-w-[90vw] snap-center overflow-y-auto scrollbar-transparent"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full">
          <SWEditor
            perspective={item.perspective}
            timings={item.timings}
            audioRef={audioRef}
            currentTime={item.currentTime}
            isPlaying={isPlaying}
            isActive={item.isActive}
            onSeek={onSeek}
            readOnly={true}
            showTimingLabels={true}
            showSelection={true}
            selectedWordIndex={
              item.isActive ? item.selectedWordIndex : undefined
            }
            onSelectWord={(index) => onSelectWord(item.perspective.id, index)}
            highlightDurationScale={highlightDurationScale}
            leadingControl={item.leadingControl}
          />
        </div>
      </div>
    </div>
  ));
};
