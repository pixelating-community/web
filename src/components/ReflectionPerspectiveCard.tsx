"use client";

import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { PerspectiveMarkup } from "@/components/PerspectiveMarkup";
import { hasPlayableAudioSource } from "@/components/sw/runtime";
import { buildTopicViewerPerspectivePath } from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

type ReflectionPerspectiveCardProps = {
  perspective: Perspective;
  topicName: string;
};

export const ReflectionPerspectiveCard = memo(function ReflectionPerspectiveCard({
  perspective,
  topicName,
}: ReflectionPerspectiveCardProps) {
  const href = buildTopicViewerPerspectivePath({
    topicName,
    perspectiveId: perspective.id,
  });
  const hasAudio =
    hasPlayableAudioSource(perspective.recording_src) ||
    hasPlayableAudioSource(perspective.audio_src);

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="reflection-card-text line-clamp-3 text-[clamp(0.25rem,0.75vw,1rem)] text-white/80">
        <PerspectiveMarkup perspective={perspective} className="flex flex-col" />
      </div>
      <Link
        to={href}
        preload="intent"
        viewTransition
        className={`unstyled-link mt-2 inline-flex h-7 w-7 items-center justify-center rounded-[8px] transition ${
          hasAudio
            ? "text-[1rem] leading-none text-(--color-neon-teal) hover:opacity-80"
            : "text-xs text-white/40 hover:text-white/70"
        }`}
        aria-label={hasAudio ? "Play reflection" : "Open reflection"}
        title={hasAudio ? "Play reflection" : "Open reflection"}
      >
        {hasAudio ? "▶" : "⇓"}
      </Link>
    </div>
  );
});
