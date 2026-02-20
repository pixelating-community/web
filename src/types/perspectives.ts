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
  audio_src?: string;
  recording_src?: string;
  remix_audio_src?: string;
  remix_duration?: number;
  remix_updated_at?: string;
  remix_waveform?: number[];
  start_time?: number;
  end_time?: number;
  symbols?: Cue[];
  rendered_html?: string | null;
  words?: string[];
  wordTimings?: WordTimingEntry[];
  audio_mix_input_src?: string;
  audio_mix_src?: string;
};

export type AudioMixSnippet = {
  id: string;
  perspectiveId: string;
  r2Key: string;
  startTime: number;
  endTime: number;
};

export type WritePerspectiveProps = {
  actionToken?: string;
  id: UUID;
  name: string;
  topicEmoji?: string;
  forward?: boolean;
  link?: string;
  perspectives: Perspective[];
  initialPerspectiveId?: string;
  queryKey?: readonly unknown[];
  onRefresh?: () => Promise<void> | void;
};
