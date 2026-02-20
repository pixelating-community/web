import type { RefObject } from "react";
import { SWEditor } from "@/components/SWEditor";
import type { SWSurfaceItem } from "@/components/sw/types";
import { buildTopicViewerPerspectivePath } from "@/lib/topicRoutes";

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
  topicName?: string;
};

export const SWViewerSurface = ({
  audioRef,
  isPlaying,
  items,
  onSeek,
  onSelectWord,
  registerPerspectiveRef,
  topicName,
}: SWViewerSurfaceProps) => {
  return items.map((item) => {
    const reflectionCount = item.perspective.reflection_count ?? 0;
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
          selectedWordIndex={
            item.isActive ? item.selectedWordIndex : undefined
          }
          onSelectWord={(index) => onSelectWord(item.perspective.id, index)}
          leadingControl={item.leadingControl}
        />
        {reflectionCount > 0 && topicName ? (
          <a
            href={`${buildTopicViewerPerspectivePath({
              topicName,
              perspectiveId: item.perspective.id,
            })}#reflections`}
            className="unstyled-link mt-2 text-xs text-white/40 hover:text-white/70"
          >
            💭 x {reflectionCount}
          </a>
        ) : reflectionCount > 0 ? (
          <div className="mt-2 text-xs text-white/40">
            💭 x {reflectionCount}
          </div>
        ) : null}
      </div>
    );

    return (
      <div
        key={item.perspective.id}
        ref={(node) => {
          registerPerspectiveRef(item.perspective.id, node);
        }}
        data-id={item.perspective.id}
        className="defer-offscreen h-full min-w-[80vw] snap-center overflow-y-auto"
      >
        <div className="flex min-h-full items-center justify-center p-4">
          {content}
        </div>
      </div>
    );
  });
};
