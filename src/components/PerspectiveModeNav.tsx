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
  onShareToggle?: () => void;
  isShareActive?: boolean;
  onNewPerspective?: () => void;
};

type NavItem = {
  emoji: string;
  href: string;
  key: PerspectiveMode;
  label: string;
};

const BASE_ITEM_CLASS =
  "unstyled-link inline-flex h-11 min-w-11 items-center justify-center border-0 bg-transparent px-3 py-1 text-lg touch-manipulation transition";

export const PerspectiveModeNav = ({
  canWrite = false,
  currentMode,
  perspectiveId,
  showViewMode = true,
  topicName,
  onShareToggle,
  isShareActive = false,
  onNewPerspective,
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
          emoji: "🖋️",
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
      {onShareToggle ? (
        <button
          type="button"
          onClick={onShareToggle}
          aria-label="Share"
          title="Share"
          className={`${BASE_ITEM_CLASS} ${
            isShareActive
              ? "text-white"
              : "text-white/85 hover:text-white"
          }`}
        >
          <span aria-hidden="true">🫂</span>
        </button>
      ) : null}
      {availableItems.map((item) => (
        <Link
          key={item.key}
          to={item.href}
          preload="intent"
          aria-label={item.label}
          title={item.label}
          className={`${BASE_ITEM_CLASS} text-white/85 hover:text-white`}
        >
          <span aria-hidden="true">{item.emoji}</span>
        </Link>
      ))}
      {onNewPerspective ? (
        <button
          type="button"
          onClick={onNewPerspective}
          aria-label="New perspective"
          title="New perspective"
          className={`${BASE_ITEM_CLASS} text-white/85 hover:text-white`}
        >
          <span aria-hidden="true">⊕</span>
        </button>
      ) : null}
    </nav>
  );
};
