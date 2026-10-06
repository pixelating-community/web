import type { RefObject } from "react";
import { SWEditor } from "@/components/SWEditor";
import type { SWSurfaceItem } from "@/components/sw/types";

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
  return items.map((item) => {
    const content = (
      <div className="flex w-full flex-col items-center">
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
          selectedWordIndex={item.isActive ? item.selectedWordIndex : undefined}
          onSelectWord={(index) => onSelectWord(item.perspective.id, index)}
          leadingControl={item.leadingControl}
        />
      </div>
    );

    return (
      <div
        key={item.perspective.id}
        ref={(node) => {
          registerPerspectiveRef(item.perspective.id, node);
        }}
        data-id={item.perspective.id}
        className="defer-offscreen h-full w-[80vw] shrink-0 snap-center overflow-y-auto"
      >
        <div className="flex min-h-full items-center justify-center p-4">
          {content}
        </div>
      </div>
    );
  });
};
