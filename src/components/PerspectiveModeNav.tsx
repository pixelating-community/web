"use client";

import { Link } from "@tanstack/react-router";
import {
  buildTopicPath,
  buildTopicPerspectivePath,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
} from "@/lib/topicRoutes";

type PerspectiveMode = "view" | "listen" | "write" | "record";

type PerspectiveModeNavProps = {
  canWrite?: boolean;
  currentMode: PerspectiveMode;
  perspectiveId?: string;
  showViewMode?: boolean;
  topicName: string;
};

type NavItem = {
  emoji: string;
  href: string;
  key: PerspectiveMode;
  label: string;
};

const BASE_ITEM_CLASS =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-xl border-0 px-3 py-1 text-lg no-underline touch-manipulation backdrop-blur transition";

export const PerspectiveModeNav = ({
  canWrite = false,
  currentMode,
  perspectiveId,
  showViewMode = true,
  topicName,
}: PerspectiveModeNavProps) => {
  const trimmedTopicName = topicName.trim();
  const trimmedPerspectiveId = perspectiveId?.trim() ?? "";

  if (!trimmedTopicName) return null;

  const items: NavItem[] = [];

  if (showViewMode) {
    items.push({
      emoji: "👁️",
      href: buildTopicPath(trimmedTopicName),
      key: "view",
      label: "View",
    });
  }

  if (trimmedPerspectiveId) {
    items.push({
      emoji: "🔊",
      href: buildTopicViewerPerspectivePath({
        topicName: trimmedTopicName,
        perspectiveId: trimmedPerspectiveId,
      }),
      key: "listen",
      label: "Listen",
    });
    if (canWrite) {
      items.push(
        {
          emoji: "✏️",
          href: buildTopicWritePerspectivePath({
            topicName: trimmedTopicName,
            perspectiveId: trimmedPerspectiveId,
          }),
          key: "write",
          label: "Write",
        },
        {
          emoji: "🔴",
          href: buildTopicPerspectivePath({
            topicName: trimmedTopicName,
            perspectiveId: trimmedPerspectiveId,
          }),
          key: "record",
          label: "Record",
        },
      );
    }
  }

  const availableItems = items.filter((item) => item.key !== currentMode);

  if (availableItems.length === 0) return null;

  return (
    <nav
      className="absolute top-3 right-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-wrap justify-end gap-2"
      aria-label="Perspective modes"
    >
      {availableItems.map((item) => (
        <Link
          key={item.key}
          to={item.href}
          preload="intent"
          startTransition
          aria-label={item.label}
          title={item.label}
          className={`${BASE_ITEM_CLASS} bg-white/10 text-white/85 hover:bg-white/14 hover:text-white`}
        >
          <span aria-hidden="true">{item.emoji}</span>
        </Link>
      ))}
    </nav>
  );
};
