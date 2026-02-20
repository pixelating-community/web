import type { UUID } from "node:crypto";

export type CueType = "text" | "audio" | "emoji" | "css" | "midi";

export type Cue = {
  id?: UUID;
  content: string;
  timestamp: number;
  type?: CueType;
  style?: string;
  fontSize?: number;
  url?: string;
  track?: number;
  cell?: number;
  wordIndex?: number;
};
