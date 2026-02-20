import type { RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { SWEditor } from "@/components/SWEditor";
import type { SWSurfaceItem } from "@/components/sw/types";

type SWViewerSurfaceProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  items: SWSurfaceItem[];
  onSeek: (time: number) => void;
  onSelectWord: (perspectiveId: string, index: number) => void;
  perspectiveHref?: (perspectiveId: string) => string;
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
  perspectiveHref,
  registerPerspectiveRef,
}: SWViewerSurfaceProps) => {
  return items.map((item) => {
    const href = perspectiveHref?.(item.perspective.id);
    const content = (
      <div className="flex h-full w-full flex-col items-center justify-center">
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
    );

    if (href) {
      return (
        <Link
          key={item.perspective.id}
          ref={(node) => {
            registerPerspectiveRef(item.perspective.id, node as HTMLDivElement | null);
          }}
          to={href}
          startTransition
          data-id={item.perspective.id}
          className="unstyled-link defer-offscreen flex h-full min-w-[80vw] cursor-pointer snap-center items-center justify-center p-4"
        >
          {content}
        </Link>
      );
    }

    return (
      <div
        key={item.perspective.id}
        ref={(node) => {
          registerPerspectiveRef(item.perspective.id, node);
        }}
        data-id={item.perspective.id}
        className="defer-offscreen flex h-full min-w-[80vw] snap-center items-center justify-center p-4"
      >
        {content}
      </div>
    );
  });
};
