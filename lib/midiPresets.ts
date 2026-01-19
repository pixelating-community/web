import type {
  GridCell,
  MidiCCCellMapping,
  MidiNoteMapping,
} from "@/types/symbol";

export const FONT_SIZE_RANGE_PX = { min: 12, max: 84 };

export const MPK_MINI_DEFAULTS = {
  noteStart: 36,
  padCount: 16,
  knobCcStart: 70,
  knobCount: 8,
};

export const createSequentialNoteMap = (
  grid: GridCell[][],
  startNote: number,
  maxNotes?: number,
) => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const totalCells = rows * cols;
  const limit = maxNotes ? Math.min(totalCells, maxNotes) : totalCells;
  const noteMap: MidiNoteMapping[] = [];
  let note = startNote;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (noteMap.length >= limit) return noteMap;
      noteMap.push({ note, row, col });
      note += 1;
    }
  }

  return noteMap;
};

export const createCCCellMap = (
  grid: GridCell[][],
  ccStart: number,
  count: number,
  min: number,
  max: number,
) => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const totalCells = rows * cols;
  const limit = Math.min(totalCells, count);
  const ccCellMap: MidiCCCellMapping[] = [];
  let cc = ccStart;
  let mapped = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (mapped >= limit) return ccCellMap;
      ccCellMap.push({ cc, row, col, min, max });
      cc += 1;
      mapped += 1;
    }
  }

  return ccCellMap;
};

export const createMpkMiniNoteMap = (grid: GridCell[][]) =>
  createSequentialNoteMap(
    grid,
    MPK_MINI_DEFAULTS.noteStart,
    MPK_MINI_DEFAULTS.padCount,
  );

export const createMpkMiniCCCellMap = (grid: GridCell[][]) =>
  createCCCellMap(
    grid,
    MPK_MINI_DEFAULTS.knobCcStart,
    MPK_MINI_DEFAULTS.knobCount,
    FONT_SIZE_RANGE_PX.min,
    FONT_SIZE_RANGE_PX.max,
  );
