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
};

export type CueGridConfig = {
  rows: number;
  cols: number;
  cells: Map<number, { content: string; type: CueType }>;
};
export type GridCell = {
  content: string;
  type: CueType;
  style?: string;
  fontSize?: number;
};

export type MidiNoteMapping = {
  note: number;
  channel?: number;
  row: number;
  col: number;
};

export type MidiCCMapping = {
  cc: number;
  channel?: number;
  target: "rotation" | "fontSize" | "opacity" | "scale";
  min: number;
  max: number;
};

export type MidiCCCellMapping = {
  cc: number;
  channel?: number;
  row: number;
  col: number;
  min: number;
  max: number;
};

export type KeyboardMapping = {
  key: string;
  row: number;
  col: number;
};

export type MidiConfig = {
  grid: GridCell[][];
  noteMap: MidiNoteMapping[];
  ccMap: MidiCCMapping[];
  ccCellMap?: MidiCCCellMapping[];
  keyMap: KeyboardMapping[];
  customPalette?: GridCell[];
};
