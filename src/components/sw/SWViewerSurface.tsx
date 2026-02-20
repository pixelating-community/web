"use client";

import type { RefObject } from "react";
import { SWEditor } from "@/components/SWEditor";
import type { SWSurfaceItem } from "./types";

type SWViewerSurfaceProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  items: SWSurfaceItem[];
  onSeek: (time: number) => void;
  onSelectWord: (perspectiveId: string, index: number) => void;
  registerPerspectiveRef: (
    perspectiveId: string,
    node: HTMLDivElement | null,
  ) => void;
};

export const SWViewerSurface = ({
  audioRef,
  isPlaying,
  items,
  onSeek,
  onSelectWord,
  registerPerspectiveRef,
}: SWViewerSurfaceProps) => {
  return items.map((item) => (
    <div
      key={item.perspective.id}
      ref={(node) => {
        registerPerspectiveRef(item.perspective.id, node);
      }}
      data-id={item.perspective.id}
      className="defer-offscreen flex h-full min-w-[80vw] snap-center items-center justify-center p-4"
    >
      <div className="flex h-full w-full flex-col items-center justify-center">
        <div className="w-full">
          <SWEditor
            perspective={item.perspective}
            timings={item.timings}
            audioRef={audioRef}
            currentTime={item.currentTime}
            isPlaying={isPlaying}
            enablePlaybackSync={false}
            isActive={item.isActive}
            onSeek={onSeek}
            readOnly={true}
            showTimingLabels={false}
            showSelection={false}
            selectedWordIndex={
              item.isActive ? item.selectedWordIndex : undefined
            }
            onSelectWord={(index) => onSelectWord(item.perspective.id, index)}
            leadingControl={item.leadingControl}
          />
        </div>
      </div>
    </div>
  ));
};
