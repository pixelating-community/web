"use client";

import { Link } from "@tanstack/react-router";

type SwInlinePlayControlProps = {
  hasPlaybackError: boolean;
  playDisabled: boolean;
  playLabel: string;
  previewHref?: string;
  recordHref?: string;
  showStopState: boolean;
  writeHref?: string;
  onPlayClick: () => void;
};

export const SwInlinePlayControl = ({
  hasPlaybackError,
  playDisabled,
  playLabel,
  previewHref = "",
  recordHref = "",
  showStopState,
  writeHref = "",
  onPlayClick,
}: SwInlinePlayControlProps) => {
  const inlineControlSizeClass = showStopState
    ? "h-11 w-11 text-[1rem]"
    : "h-11 w-11 text-[1.2rem]";

  return (
    <div
      className={`inline-flex ${
        writeHref || recordHref || previewHref
          ? "flex-col items-center gap-1"
          : ""
      }`}
    >
      <button
        type="button"
        onClick={onPlayClick}
        disabled={playDisabled}
        aria-label={playLabel}
        title={playLabel}
        className={`inline-flex ${inlineControlSizeClass} touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none transition-[color,transform,width,height] duration-150 ${
          playDisabled
            ? "cursor-not-allowed text-white/30"
            : hasPlaybackError
              ? "text-red-200"
              : showStopState
                ? "text-teal-200"
                : "text-(--color-neon-teal)"
        }`}
      >
        {hasPlaybackError ? "!" : showStopState ? "■" : "▶"}
      </button>
      {previewHref ? (
        <Link
          to={previewHref}
          preload="intent"
          startTransition
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label="Open viewer preview"
          title="Open viewer preview"
          className="inline-flex h-6 w-6 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-black/25 text-xs text-white/90 sm:hidden"
        >
          👁️
        </Link>
      ) : null}
      {writeHref ? (
        <Link
          to={writeHref}
          preload="intent"
          startTransition
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label="Open write editor"
          title="Open write editor"
          className="inline-flex h-6 w-6 touch-manipulation items-center justify-center rounded-full border border-white/20 bg-black/25 text-sm text-white/90"
        >
          ✏️
        </Link>
      ) : null}
      {recordHref ? (
        <Link
          to={recordHref}
          preload="intent"
          startTransition
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label="Open recording editor"
          title="Open recording editor"
          className="inline-flex h-6 w-6 touch-manipulation items-center justify-center rounded-full border border-red-300/45 bg-red-500/20 text-xs text-red-100"
        >
          🔴
        </Link>
      ) : null}
    </div>
  );
};
