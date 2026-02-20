"use client";

type SwInlinePlayControlProps = {
  playDisabled: boolean;
  playLabel: string;
  previewHref?: string;
  recordHref?: string;
  showStopState: boolean;
  writeHref?: string;
  onPlayClick?: () => void;
};

export const SwInlinePlayControl = ({
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
        writeHref || recordHref || previewHref || onPlayClick
          ? "flex-col items-center gap-1"
          : ""
      }`}
    >
      {onPlayClick ? (
        <button
          type="button"
          onClick={onPlayClick}
          disabled={playDisabled}
          aria-label={playLabel}
          title={playLabel}
          className={`inline-flex ${inlineControlSizeClass} touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none transition-[color,transform,width,height] duration-150 ${
            playDisabled
              ? "cursor-not-allowed text-white/30"
              : showStopState
                ? "text-teal-200"
                : "text-(--color-neon-teal)"
          }`}
        >
          {showStopState ? "■" : "▶"}
        </button>
      ) : previewHref ? (
        <a
          href={playDisabled ? undefined : previewHref}
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label={playLabel}
          aria-disabled={playDisabled}
          title={playLabel}
          className={`unstyled-link inline-flex ${inlineControlSizeClass} touch-manipulation items-center justify-center rounded-[10px] border border-transparent bg-transparent p-0 leading-none ${
            playDisabled ? "cursor-not-allowed text-white/30" : "text-(--color-neon-teal)"
          }`}
        >
          ▶
        </a>
      ) : null}
      {writeHref ? (
        <a
          href={writeHref}
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label="Open write editor"
          title="Open write editor"
          className="unstyled-link inline-flex h-6 w-6 touch-manipulation items-center justify-center border-0 bg-transparent text-sm text-white/90"
        >
          🖋️
        </a>
      ) : null}
      {recordHref ? (
        <a
          href={recordHref}
          onClick={(event) => {
            event.stopPropagation();
          }}
          aria-label="Open recording editor"
          title="Open recording editor"
          className="unstyled-link inline-flex h-6 w-6 touch-manipulation items-center justify-center border-0 bg-transparent text-xs text-white/90"
        >
          🔴
        </a>
      ) : null}
    </div>
  );
};
