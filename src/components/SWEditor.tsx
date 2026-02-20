"use client";

import type { ReactNode } from "react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { coerceTimingEntry } from "@/components/sw/editorUtils";
import { getPerspectiveHtml } from "@/lib/perspectiveHtml";
import {
  findActiveWordIndex,
  getTimingDuration,
} from "@/lib/swPlayback";
import type {
  Perspective,
  WordTimingEntry,
} from "@/types/perspectives";

export type SWEditorProps = {
  perspective: Perspective;
  timings: WordTimingEntry[];
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  isPlaying: boolean;
  onSeek?: (time: number) => void;
  enablePlaybackSync?: boolean;
  allowWordSeek?: boolean;
  isActive?: boolean;
  readOnly?: boolean;
  showTimingLabels?: boolean;
  showSelection?: boolean;
  selectedWordIndex?: number | null;
  onSelectWord?: (index: number) => void;
  highlightDurationScale?: number;
  leadingControl?: ReactNode;
};

const WORD_SELECTOR = "[data-word-index]";

const formatEndOffsetLabel = (
  timing: { start: number; end?: number | null } | null,
  scale: number,
) => {
  if (!timing) return null;
  const { end, start } = timing;
  if (typeof end !== "number" || !Number.isFinite(end)) return null;
  return `+${Math.max(0, (end - start) * scale).toFixed(2)}`;
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
    "items-center",
    "border-0",
    "bg-transparent",
    "pt-[0.02em]",
    "pb-[0.08em]",
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
  enablePlaybackSync = true,
  allowWordSeek = true,
  isActive = true,
  readOnly = false,
  showTimingLabels = true,
  showSelection = true,
  selectedWordIndex,
  onSelectWord,
  highlightDurationScale = 1,
  leadingControl,
}: SWEditorProps) => {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const hasLeadingControl = Boolean(leadingControl);
  const hasInteractiveTiming = timings.length > 0;
  const hasPerspectiveAudio = Boolean(perspective.audio_src?.trim());
  const shouldEnableWordMode =
    enablePlaybackSync && readOnly && (hasInteractiveTiming || hasPerspectiveAudio);

  const playbackWordIndex = useMemo(() => {
    if (!isActive) return -1;
    if (currentTime <= 0 && !isPlaying) return -1;
    const timingIndex = findActiveWordIndex(timings, currentTime);
    return timingIndex < 0 ? -1 : timingIndex;
  }, [timings, currentTime, isActive, isPlaying]);
  const activeWordIndex = playbackWordIndex;

  const applyWordStateRef = useRef<() => void>(null);

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

    applyWordStateRef.current?.();
  }, [perspective, readOnly, shouldEnableWordMode]);

  const prevActiveWordRef = useRef<HTMLElement | null>(null);

  // Full word state: runs when activeWordIndex, selection, or timings change — NOT on every currentTime tick
  const applyWordState = useCallback(() => {
    if (!readOnly || !shouldEnableWordMode) return;
    const root = viewerRef.current;
    if (!root) return;
    const words = root.querySelectorAll<HTMLElement>(WORD_SELECTOR);
    let nextActiveEl: HTMLElement | null = null;
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
      const endOffsetLabel = shouldShowTimingLabel
        ? formatEndOffsetLabel(timing, highlightDurationScale)
        : null;
      const rawDuration = timing
        ? getTimingDuration(timings, timingIndex)
        : 0.12;
      const durationSeconds = rawDuration * highlightDurationScale;
      wordElement.style.setProperty(
        "--sw-dur",
        `${Math.max(0.01, durationSeconds)}s`,
      );

      if (isPlayback) {
        nextActiveEl = wordElement;
      } else {
        wordElement.style.removeProperty("--sw-progress");
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

      if (showTimingLabels && isSelected && endOffsetLabel) {
        wordElement.title = endOffsetLabel;
      } else {
        wordElement.removeAttribute("title");
      }
    }
    prevActiveWordRef.current = nextActiveEl;
  }, [
    activeWordIndex,
    highlightDurationScale,
    isActive,
    readOnly,
    selectedWordIndex,
    showSelection,
    showTimingLabels,
    shouldEnableWordMode,
    timings,
    timings,
  ]);

  applyWordStateRef.current = applyWordState;

  useEffect(() => {
    applyWordState();
  }, [applyWordState]);

  // Lightweight progress update: only touches the active word element, runs on every currentTime tick
  useEffect(() => {
    const el = prevActiveWordRef.current;
    if (!el || activeWordIndex < 0) return;
    const timing = coerceTimingEntry(timings, activeWordIndex);
    if (!timing) return;
    const rawDuration = getTimingDuration(timings, activeWordIndex);
    const durationSeconds = rawDuration * highlightDurationScale;
    const elapsed = currentTime - timing.start;
    const progress = durationSeconds > 0
      ? Math.min(1, Math.max(0, elapsed / durationSeconds))
      : 1;
    el.style.setProperty("--sw-progress", String(progress));
  }, [timings, activeWordIndex, currentTime, highlightDurationScale, timings]);

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
    if (!readOnly || !shouldEnableWordMode || !allowWordSeek) return;
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
  }, [allowWordSeek, onSelectWord, readOnly, seekToTiming, shouldEnableWordMode]);

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
            ? "overflow-x-clip overflow-y-visible whitespace-pre-line outline-none"
            : "overflow-x-clip overflow-y-visible whitespace-pre-line outline-none"
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
  if (prev.enablePlaybackSync !== next.enablePlaybackSync) return false;
  if (prev.allowWordSeek !== next.allowWordSeek) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.readOnly !== next.readOnly) return false;
  if (prev.showTimingLabels !== next.showTimingLabels) return false;
  if (prev.showSelection !== next.showSelection) return false;
  if (prev.selectedWordIndex !== next.selectedWordIndex) return false;
  if (prev.highlightDurationScale !== next.highlightDurationScale) return false;

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
