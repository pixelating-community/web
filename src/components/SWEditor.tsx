"use client";

import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { coerceTimingEntry } from "@/components/sw/editorUtils";
import { getPerspectiveHtml } from "@/lib/perspectiveHtml";
import {
  findActiveWordIndex,
  getTimingDuration,
  normalizePlaybackTimings,
} from "@/lib/swPlayback";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

export type SWEditorProps = {
  perspective: Perspective;
  timings: WordTimingEntry[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  isActive?: boolean;
  readOnly?: boolean;
  showTimingLabels?: boolean;
  showSelection?: boolean;
  selectedWordIndex?: number | null;
  onSelectWord?: (index: number) => void;
  leadingControl?: ReactNode;
};

const WORD_SELECTOR = "[data-word-index]";

const formatTimingLabel = (timing: { start: number } | null) =>
  timing ? `${timing.start.toFixed(2)}` : null;

const formatEndOffsetLabel = (
  timing: { start: number; end?: number | null } | null,
) => {
  if (!timing) return null;
  const { end, start } = timing;
  if (typeof end !== "number" || !Number.isFinite(end)) return null;
  return `+${Math.max(0, end - start).toFixed(2)}`;
};

const parseWordIndex = (node: HTMLElement) => {
  const raw = node.dataset.wordIndex;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
};

const ensureWordElementStructure = (wordElement: HTMLElement) => {
  wordElement.classList.add(
    "sw-word",
    "inline-flex",
    "border-0",
    "bg-transparent",
    "px-0.5",
    "py-0",
    "rounded-sm",
    "transition-colors",
  );

  let textElement = wordElement.querySelector(":scope > .sw-text");
  if (!textElement) {
    const text = wordElement.textContent ?? "";
    wordElement.textContent = "";
    textElement = document.createElement("span");
    textElement.className = "sw-text";
    textElement.textContent = text;
    wordElement.appendChild(textElement);
  }

  const hasBg = wordElement.querySelector(":scope > .sw-bg");
  if (!hasBg) {
    const bg = document.createElement("span");
    bg.className = "sw-bg";
    bg.setAttribute("aria-hidden", "true");
    wordElement.prepend(bg);
  }
};

const isSkippableParent = (node: HTMLElement) =>
  Boolean(node.closest("code,pre,script,style")) ||
  Boolean(node.closest(WORD_SELECTOR));

const wrapLegacyTextNodes = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node = walker.nextNode();

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      if (
        parent &&
        !isSkippableParent(parent) &&
        (textNode.nodeValue ?? "").trim()
      ) {
        textNodes.push(textNode);
      }
    }
    node = walker.nextNode();
  }

  let wordIndex = -1;
  for (const textNode of textNodes) {
    const value = textNode.nodeValue;
    if (!value) continue;
    const parts = value.split(/(\s+)/);
    const fragment = document.createDocumentFragment();

    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        continue;
      }
      wordIndex += 1;
      const wordElement = document.createElement("span");
      wordElement.dataset.wordIndex = String(wordIndex);
      ensureWordElementStructure(wordElement);
      const textElement = wordElement.querySelector(":scope > .sw-text");
      if (textElement) {
        textElement.textContent = part;
      }
      fragment.appendChild(wordElement);
    }
    textNode.replaceWith(fragment);
  }
};

const SWEditorComponent = ({
  perspective,
  timings,
  audioRef,
  currentTime,
  isPlaying,
  onSeek,
  isActive = true,
  readOnly = false,
  showTimingLabels = true,
  showSelection = true,
  selectedWordIndex,
  onSelectWord,
  leadingControl,
}: SWEditorProps) => {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const hasLeadingControl = Boolean(leadingControl);
  const activePlaybackTimings = useMemo(
    () => normalizePlaybackTimings(timings),
    [timings],
  );
  const hasInteractiveTiming = activePlaybackTimings.length > 0;
  const hasPerspectiveAudio = Boolean(perspective.audio_src?.trim());
  const shouldEnableWordMode =
    readOnly && (hasInteractiveTiming || hasPerspectiveAudio);

  const playbackWordIndex = useMemo(() => {
    if (!isActive) return -1;
    if (currentTime <= 0 && !isPlaying) return -1;
    const timingIndex = findActiveWordIndex(activePlaybackTimings, currentTime);
    return timingIndex < 0 ? -1 : timingIndex;
  }, [activePlaybackTimings, currentTime, isActive, isPlaying]);
  const activeWordIndex = playbackWordIndex;

  useEffect(() => {
    if (!readOnly) return;
    const root = viewerRef.current;
    if (!root) return;

    root.innerHTML = getPerspectiveHtml(perspective);
    if (!shouldEnableWordMode) return;

    let words = Array.from(root.querySelectorAll<HTMLElement>(WORD_SELECTOR));
    if (words.length === 0) {
      wrapLegacyTextNodes(root);
      words = Array.from(root.querySelectorAll<HTMLElement>(WORD_SELECTOR));
    }

    for (const wordElement of words) {
      ensureWordElementStructure(wordElement);
    }
  }, [perspective, readOnly, shouldEnableWordMode]);

  const applyWordState = useCallback(() => {
    if (!readOnly || !shouldEnableWordMode) return;
    const root = viewerRef.current;
    if (!root) return;
    const words = root.querySelectorAll<HTMLElement>(WORD_SELECTOR);
    for (const wordElement of words) {
      const index = parseWordIndex(wordElement);
      if (index === null) continue;
      const timingIndex = index;
      const timing = coerceTimingEntry(timings, timingIndex);
      const isPlayback =
        isActive &&
        activeWordIndex >= 0 &&
        index === activeWordIndex &&
        Boolean(timing);
      const isSelected = showSelection && selectedWordIndex === timingIndex;
      const shouldShowTimingLabel = showTimingLabels && isSelected;
      const timingLabel = shouldShowTimingLabel
        ? formatTimingLabel(timing)
        : null;
      const endOffsetLabel = shouldShowTimingLabel
        ? formatEndOffsetLabel(timing)
        : null;
      const durationSeconds = timing
        ? getTimingDuration(activePlaybackTimings, timingIndex)
        : 0.12;
      wordElement.style.setProperty(
        "--sw-dur",
        `${Math.max(0.01, durationSeconds)}s`,
      );

      if (timingLabel) {
        wordElement.classList.add("has-timing");
        wordElement.dataset.startLabel = timingLabel;
      } else {
        wordElement.classList.remove("has-timing");
        delete wordElement.dataset.startLabel;
      }

      if (endOffsetLabel) {
        wordElement.classList.add("has-end-offset");
        wordElement.dataset.endOffsetLabel = endOffsetLabel;
      } else {
        wordElement.classList.remove("has-end-offset");
        delete wordElement.dataset.endOffsetLabel;
      }

      wordElement.classList.toggle("is-playback", isPlayback);
      wordElement.classList.toggle("ring-[0.5px]", isSelected);
      wordElement.classList.toggle("ring-purple-300/80", isSelected);

      if (showTimingLabels && isSelected) {
        const titleStart = formatTimingLabel(timing);
        const titleEndOffset = formatEndOffsetLabel(timing);
        wordElement.title = titleStart
          ? titleEndOffset
            ? `${titleStart} (${titleEndOffset})`
            : titleStart
          : "No timing";
      } else {
        wordElement.removeAttribute("title");
      }
    }
  }, [
    activeWordIndex,
    isActive,
    readOnly,
    selectedWordIndex,
    showSelection,
    showTimingLabels,
    shouldEnableWordMode,
    activePlaybackTimings,
    timings,
  ]);

  useEffect(() => {
    applyWordState();
  }, [applyWordState]);

  const seekToTiming = useCallback(
    (index: number) => {
      const timing = coerceTimingEntry(timings, index);
      if (!timing) return;
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = timing.start;
      }
      onSeek?.(timing.start);
    },
    [audioRef, onSeek, timings],
  );

  useEffect(() => {
    if (!readOnly || !shouldEnableWordMode) return;
    const root = viewerRef.current;
    if (!root) return;
    const handleClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const wordNode = target.closest("[data-word-index]");
      if (!(wordNode instanceof HTMLElement)) return;
      const rawIndex = wordNode.dataset.wordIndex;
      if (!rawIndex) return;
      const renderIndex = Number.parseInt(rawIndex, 10);
      if (!Number.isInteger(renderIndex) || renderIndex < 0) return;
      const timingIndex = renderIndex;
      onSelectWord?.(timingIndex);
      seekToTiming(timingIndex);
    };
    root.addEventListener("click", handleClick);
    return () => {
      root.removeEventListener("click", handleClick);
    };
  }, [onSelectWord, readOnly, seekToTiming, shouldEnableWordMode]);

  return (
    <div
      className={
        readOnly
          ? "w-full h-full flex flex-col justify-center bg-transparent"
          : "w-full min-h-0 px-4 py-4 rounded-lg flex flex-col justify-center bg-transparent"
      }
    >
      <div
        className={
          showTimingLabels
            ? "overflow-x-hidden overflow-y-visible whitespace-pre-line outline-none pt-2"
            : "overflow-hidden whitespace-pre-line outline-none"
        }
      >
        <div
          className={`flex items-center ${hasLeadingControl ? "gap-3" : ""}`}
        >
          {hasLeadingControl ? (
            <div className="shrink-0">{leadingControl}</div>
          ) : null}
          <div className="flex-1 min-w-0">
            <div
              ref={viewerRef}
              className="flex flex-col w-full text-left whitespace-pre-line leading-[1.15] [&_p]:my-0 [&_p+p]:mt-[0.2em] has-[blockquote]:border-l-2 has-[blockquote]:border-purple-700 has-[blockquote]:pl-2 text-shadow-2xs text-shadow-purple-200/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const areSWEditorPropsEqual = (prev: SWEditorProps, next: SWEditorProps) => {
  if (prev.perspective !== next.perspective) return false;
  if (prev.timings !== next.timings) return false;
  if (prev.audioRef !== next.audioRef) return false;
  if (prev.onSeek !== next.onSeek) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.showTimingLabels !== next.showTimingLabels) return false;
  if (prev.showSelection !== next.showSelection) return false;
  if (prev.selectedWordIndex !== next.selectedWordIndex) return false;

  // Ignore `leadingControl` and `onSelectWord` identity churn for inactive cards.
  if (
    prev.isActive ||
    next.isActive ||
    prev.currentTime > 0 ||
    next.currentTime > 0
  ) {
    if (prev.isPlaying !== next.isPlaying) return false;
    if (prev.currentTime !== next.currentTime) return false;
  }

  return true;
};

export const SWEditor = memo(SWEditorComponent, areSWEditorPropsEqual);
SWEditor.displayName = "SWEditor";
