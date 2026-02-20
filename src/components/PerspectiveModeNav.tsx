"use client";

import { Link } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import {
  buildTopicKaraokeEditorPath,
  buildTopicKaraokePath,
  buildTopicPath,
  buildTopicPerspectivePath,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
} from "@/lib/topicRoutes";

type PerspectiveMode = "view" | "listen" | "write" | "record" | "karaoke" | "karaoke-editor";

type PerspectiveModeNavProps = {
  canWrite?: boolean;
  currentMode: PerspectiveMode;
  perspectiveId?: string;
  parentPerspectiveId?: string;
  reserveStartSpace?: boolean;
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
  "unstyled-link inline-flex h-10 min-w-10 items-center justify-center border-0 bg-transparent px-2 py-1 text-base touch-manipulation transition sm:h-11 sm:min-w-11 sm:px-3 sm:text-lg";

export const PerspectiveModeNav = ({
  canWrite = false,
  currentMode,
  perspectiveId,
  parentPerspectiveId,
  reserveStartSpace = false,
  showViewMode = true,
  topicName,
  onShareToggle,
  isShareActive = false,
  onNewPerspective,
}: PerspectiveModeNavProps) => {
  const trimmedTopicName = topicName.trim();
  const trimmedPerspectiveId = perspectiveId?.trim() ?? "";
  const { location } = useRouterState();
  const search = location.searchStr;

  if (!trimmedTopicName) return null;

  const appendSearch = (href: string) => (search ? `${href}${search}` : href);

  const items: NavItem[] = [];

  const parentHref = parentPerspectiveId
    ? appendSearch(buildTopicViewerPerspectivePath({
        topicName: trimmedTopicName,
        perspectiveId: parentPerspectiveId,
      }))
    : "";

  if (showViewMode) {
    items.push({
      emoji: "👁️",
      href: parentHref || buildTopicPath(trimmedTopicName),
      key: "view",
      label: parentHref ? "Back to parent" : "View",
    });
  }

  if (trimmedPerspectiveId) {
    items.push({
      emoji: "🔊",
      href: appendSearch(buildTopicViewerPerspectivePath({
        topicName: trimmedTopicName,
        perspectiveId: trimmedPerspectiveId,
      })),
      key: "listen",
      label: "Listen",
    });
    items.push({
      emoji: "🎤",
      href: appendSearch(buildTopicKaraokePath({
        topicName: trimmedTopicName,
        perspectiveId: trimmedPerspectiveId,
      })),
      key: "karaoke",
      label: "Karaoke",
    });
    if (canWrite) {
      items.push({
        emoji: "🎛️",
        href: appendSearch(buildTopicKaraokeEditorPath({
          topicName: trimmedTopicName,
          perspectiveId: trimmedPerspectiveId,
        })),
        key: "karaoke-editor",
        label: "Karaoke Editor",
      });
    }
    if (canWrite) {
      items.push(
        {
          emoji: "🖋️",
          href: appendSearch(buildTopicWritePerspectivePath({
            topicName: trimmedTopicName,
            perspectiveId: trimmedPerspectiveId,
          })),
          key: "write",
          label: "Write",
        },
        {
          emoji: "🔴",
          href: appendSearch(buildTopicPerspectivePath({
            topicName: trimmedTopicName,
            perspectiveId: trimmedPerspectiveId,
          })),
          key: "record",
          label: "Record",
        },
      );
    }
  }

  const availableItems = items.filter((item) => item.key !== currentMode);

  if (availableItems.length === 0) return null;

  const navMaxWidthClass = reserveStartSpace
    ? "max-w-[calc(100vw-5.75rem)] sm:max-w-[calc(100vw-1.5rem)]"
    : "max-w-[calc(100vw-1.5rem)]";

  return (
    <nav
      className={`absolute top-3 right-3 z-30 flex ${navMaxWidthClass} flex-wrap justify-end gap-1.5 sm:gap-2`}
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
          viewTransition
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
