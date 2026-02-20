"use client";

import type { ReactNode } from "react";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

export type SWPlaybackMode = "single" | "sequence";

export type ViewerPlayBehavior = "inline" | "open-perspective-page";

export type AudioPlaybackError = {
  code: number | null;
  message: string | null;
  src: string;
};

export type PlaybackTrackBounds = {
  start: number;
  end?: number;
};

export type SWSurfaceItem = {
  currentTime: number;
  isActive: boolean;
  leadingControl: ReactNode;
  perspective: Perspective;
  selectedWordIndex?: number;
  timings: WordTimingEntry[];
};
