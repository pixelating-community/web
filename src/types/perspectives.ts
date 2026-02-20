import type { UUID } from "node:crypto";
import type { Cue } from "@/types/symbol";

export type WordTiming = {
  start: number;
  end?: number;
  word?: string;
};

export type WordTimingEntry = WordTiming | null;

export type Perspective = {
  id: UUID;
  perspective: string;
  topic_id: UUID;
  objective_src?: string;
  description?: string;
  width?: number;
  height?: number;
  collection_id?: UUID;
  audio_src?: string;
  start_time?: number;
  end_time?: number;
  symbols?: Cue[];
  rendered_html?: string | null;
  words?: string[];
  wordTimings?: WordTimingEntry[];
};

export type WritePerspectiveProps = {
  id: UUID;
  name: string;
  forward?: boolean;
  link?: string;
  perspectives: Perspective[];
  swPerspectiveHrefBuilder?: (perspective: Perspective) => string;
  queryKey?: readonly unknown[];
  onRefresh?: () => Promise<void> | void;
};
