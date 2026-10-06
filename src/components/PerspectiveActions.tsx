"use client";

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PerspectiveSupport } from "@/components/PerspectiveSupport";
import { hasPlayableAudioSource } from "@/components/sw/runtime";
import { setTimestampSearchParams } from "@/lib/routeSearch";
import {
  buildTopicPerspectivePath,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
} from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

const ACTION_CLASS =
  "unstyled-link inline-flex h-11 min-w-11 items-center justify-center px-2 text-base text-white/85 hover:text-white";

export const PerspectiveActions = ({
  perspective,
  topicName,
  canWrite = false,
  showOpenLink = false,
  children,
}: {
  perspective: Perspective;
  topicName?: string;
  canWrite?: boolean;
  showOpenLink?: boolean;
  children?: ReactNode;
}) => {
  const previewPath = topicName
    ? buildTopicViewerPerspectivePath({
        topicName,
        perspectiveId: perspective.id,
      })
    : `/p/${encodeURIComponent(perspective.id)}`;
  const params = new URLSearchParams();
  setTimestampSearchParams({
    start: perspective.start_time,
    end: perspective.end_time,
    params,
  });
  const previewHref = params.size ? `${previewPath}?${params}` : previewPath;
  const hasAudio =
    hasPlayableAudioSource(perspective.recording_src) ||
    hasPlayableAudioSource(perspective.audio_src);
  const reflectionCount = perspective.reflection_count ?? 0;

  return (
    <section
      data-perspective-actions={perspective.id}
      aria-label="Perspective actions"
      className="relative z-30 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl bg-black/35 px-2 py-1 backdrop-blur-md"
    >
      {showOpenLink ? (
        <>
          <Link
            to={previewHref}
            preload="intent"
            viewTransition
            aria-label={hasAudio ? "Open playback page" : "Open perspective"}
            title={hasAudio ? "Open playback page" : "Open perspective"}
            className={`${ACTION_CLASS} text-(--color-neon-teal-light)`}
          >
            {hasAudio ? "▶" : "↗"}
          </Link>
          {canWrite && topicName ? (
            <>
              <Link
                to={buildTopicWritePerspectivePath({
                  topicName,
                  perspectiveId: perspective.id,
                })}
                preload="intent"
                aria-label="Open write editor"
                title="Open write editor"
                className={ACTION_CLASS}
              >
                🖋️
              </Link>
              <Link
                to={buildTopicPerspectivePath({
                  topicName,
                  perspectiveId: perspective.id,
                })}
                preload="intent"
                aria-label="Open recording editor"
                title="Open recording editor"
                className={ACTION_CLASS}
              >
                🔴
              </Link>
            </>
          ) : null}
        </>
      ) : null}
      {children}
      <PerspectiveSupport
        key={perspective.id}
        perspective={perspective}
        layout="horizontal"
      />
      {reflectionCount > 0 ? (
        <a
          href={showOpenLink ? `${previewPath}#reflections` : "#reflections"}
          aria-label={`View ${reflectionCount} reflections`}
          className={`${ACTION_CLASS} gap-1 text-xs`}
        >
          💭 {reflectionCount}
        </a>
      ) : null}
    </section>
  );
};
