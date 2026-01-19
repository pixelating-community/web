"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTimeShort } from "@/lib/formatTime";
import {
  createMpkMiniCCCellMap,
  createMpkMiniNoteMap,
} from "@/lib/midiPresets";
import type {
  Cue,
  GridCell,
  MidiCCCellMapping,
  MidiCCMapping,
  MidiConfig,
} from "@/types/symbol";

type CCValues = {
  rotation: number;
  fontSize: number;
  opacity: number;
  scale: number;
};

type SymbolGridProps = {
  audioRef: React.RefObject<HTMLAudioElement>;
  onRecordAction: (cue: Cue) => void;
  recordings: Cue[];
  isRecording: boolean;
  config: MidiConfig;
  onCCChangeAction?: (values: CCValues) => void;
};

const DEFAULT_GRID: GridCell[][] = [
  [
    { content: "🎵", type: "emoji" },
    { content: "🎸", type: "emoji" },
    { content: "🥁", type: "emoji" },
    { content: "🎹", type: "emoji" },
  ],
  [
    { content: "pulse", type: "css", style: "animate-pulse" },
    { content: "bounce", type: "css", style: "animate-bounce" },
    { content: "spin", type: "css", style: "animate-spin" },
    { content: "ping", type: "css", style: "animate-ping" },
  ],
  [
    { content: "1", type: "text" },
    { content: "2", type: "text" },
    { content: "3", type: "text" },
    { content: "4", type: "text" },
  ],
  [
    { content: "✨", type: "emoji" },
    { content: "🔥", type: "emoji" },
    { content: "💫", type: "emoji" },
    { content: "⚡", type: "emoji" },
  ],
];

export const DEFAULT_MIDI_CONFIG: MidiConfig = {
  grid: DEFAULT_GRID,
  noteMap: createMpkMiniNoteMap(DEFAULT_GRID),
  ccMap: [],
  ccCellMap: createMpkMiniCCCellMap(DEFAULT_GRID),
  keyMap: [
    { key: "1", row: 0, col: 0 },
    { key: "2", row: 0, col: 1 },
    { key: "3", row: 0, col: 2 },
    { key: "4", row: 0, col: 3 },
    { key: "q", row: 1, col: 0 },
    { key: "w", row: 1, col: 1 },
    { key: "e", row: 1, col: 2 },
    { key: "r", row: 1, col: 3 },
    { key: "a", row: 2, col: 0 },
    { key: "s", row: 2, col: 1 },
    { key: "d", row: 2, col: 2 },
    { key: "f", row: 2, col: 3 },
    { key: "z", row: 3, col: 0 },
    { key: "x", row: 3, col: 1 },
    { key: "c", row: 3, col: 2 },
    { key: "v", row: 3, col: 3 },
  ],
};

export const SymbolGrid = ({
  audioRef,
  onRecordAction,
  recordings,
  isRecording,
  config,
  onCCChangeAction,
}: SymbolGridProps) => {
  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const activeNotes = useRef(new Set<number>());
  const ccValuesRef = useRef<CCValues>({
    rotation: 0,
    fontSize: 48,
    opacity: 1,
    scale: 1,
  });
  const [cellFontSizes, setCellFontSizes] = useState<Record<string, number>>(
    {},
  );
  const cellFontSizesRef = useRef<Record<string, number>>({});

  const grid = config.grid.length > 0 ? config.grid : DEFAULT_GRID;
  const rows = grid.length;
  const cols = grid[0]?.length || 4;

  const noteToCell = useMemo(() => {
    const map = new Map<number, { row: number; col: number }>();
    for (const mapping of config.noteMap) {
      map.set(mapping.note, { row: mapping.row, col: mapping.col });
    }
    if (map.size === 0) {
      let note = 60;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          map.set(note++, { row, col });
        }
      }
    }
    return map;
  }, [config.noteMap, rows, cols]);

  const keyToCell = useMemo(() => {
    const map = new Map<string, { row: number; col: number }>();
    for (const mapping of config.keyMap) {
      map.set(mapping.key.toLowerCase(), {
        row: mapping.row,
        col: mapping.col,
      });
    }
    return map;
  }, [config.keyMap]);

  const ccToTarget = useMemo(() => {
    const map = new Map<number, MidiCCMapping>();
    for (const mapping of config.ccMap) {
      map.set(mapping.cc, mapping);
    }
    return map;
  }, [config.ccMap]);

  const ccToCell = useMemo(() => {
    const map = new Map<number, MidiCCCellMapping>();
    for (const mapping of config.ccCellMap ?? []) {
      map.set(mapping.cc, mapping);
    }
    return map;
  }, [config.ccCellMap]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!audioRef.current || !isRecording) return;

      const cell = grid[row]?.[col];
      if (!cell) return;
      const cellFontSize =
        cellFontSizesRef.current[`${row}-${col}`] ?? cell.fontSize;

      const timestamp = audioRef.current.currentTime;
      const cue: Cue = {
        id: crypto.randomUUID() as `${string}-${string}-${string}-${string}-${string}`,
        content: cell.content,
        timestamp,
        type: cell.type,
        style: cell.style,
        ...(cellFontSize !== undefined ? { fontSize: cellFontSize } : {}),
        track: row,
        cell: col,
      };

      setActiveCell({ row, col });
      onRecordAction(cue);

      setTimeout(() => setActiveCell(null), 150);
    },
    [audioRef, grid, isRecording, onRecordAction],
  );

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let cleanup: (() => void) | undefined;

    navigator
      .requestMIDIAccess()
      .then((midiAccess) => {
        const inputs = Array.from(midiAccess.inputs.values()).map((input) => ({
          id: input.id,
          name: input.name,
          manufacturer: input.manufacturer,
        }));
        console.info("[midi] access ready", { inputs });

        const handleMIDIMessage = (event: MIDIMessageEvent) => {
          if (!event.data || event.data.length < 3) return;
          const [status, data1, data2] = event.data;
          const messageType = status & 0xf0;
          const channel = status & 0x0f;
          const source = event.currentTarget as MIDIInput | null;
          const sourceInfo = source
            ? {
                id: source.id,
                name: source.name,
                manufacturer: source.manufacturer,
              }
            : undefined;

          const logMessage = (
            type: string,
            details: Record<string, unknown>,
          ) => {
            console.info(`[midi] ${type}`, {
              raw: Array.from(event.data),
              channel: channel + 1,
              source: sourceInfo,
              ...details,
            });
          };

          const isNoteOn = messageType === 144 && data2 > 0;
          const isNoteOff =
            messageType === 128 || (messageType === 144 && data2 === 0);

          if (isNoteOn && !activeNotes.current.has(data1)) {
            activeNotes.current.add(data1);
            const cellPos = noteToCell.get(data1);
            logMessage("note-on", {
              note: data1,
              velocity: data2,
              mapped: Boolean(cellPos),
              row: cellPos?.row,
              col: cellPos?.col,
            });
            if (cellPos) {
              handleCellClick(cellPos.row, cellPos.col);
            }
          }

          if (isNoteOff) {
            activeNotes.current.delete(data1);
            logMessage("note-off", { note: data1, velocity: data2 });
          }

          if (messageType === 160) {
            logMessage("poly-aftertouch", { note: data1, pressure: data2 });
          }

          if (messageType === 176) {
            const ccMapping = ccToTarget.get(data1);
            const ccCellMapping = ccToCell.get(data1);
            logMessage("cc", {
              cc: data1,
              value: data2,
              target: ccMapping?.target,
              cell: ccCellMapping
                ? { row: ccCellMapping.row, col: ccCellMapping.col }
                : null,
            });
            if (ccMapping && onCCChangeAction) {
              const normalized = data2 / 127;
              const value =
                ccMapping.min + normalized * (ccMapping.max - ccMapping.min);

              const newValues = { ...ccValuesRef.current };
              switch (ccMapping.target) {
                case "rotation":
                  newValues.rotation = value;
                  break;
                case "fontSize":
                  newValues.fontSize = value;
                  break;
                case "opacity":
                  newValues.opacity = value;
                  break;
                case "scale":
                  newValues.scale = value;
                  break;
              }
              ccValuesRef.current = newValues;
              onCCChangeAction(newValues);
            }

            if (ccCellMapping) {
              const normalized = data2 / 127;
              const fontSize =
                ccCellMapping.min +
                normalized * (ccCellMapping.max - ccCellMapping.min);
              const key = `${ccCellMapping.row}-${ccCellMapping.col}`;
              setCellFontSizes((prev) => {
                const nextValue = Math.round(fontSize * 100) / 100;
                if (prev[key] === nextValue) return prev;
                const next = { ...prev, [key]: nextValue };
                cellFontSizesRef.current = next;
                return next;
              });
            }
          }

          if (messageType === 192) {
            logMessage("program-change", { program: data1 });
          }

          if (messageType === 208) {
            logMessage("channel-aftertouch", { pressure: data1 });
          }

          if (messageType === 224) {
            const value = (data2 << 7) | data1;
            logMessage("pitch-bend", {
              value,
              normalized: (value - 8192) / 8192,
            });
          }

          if (messageType >= 240) {
            logMessage("system", { status });
          }
        };

        const attachedInputs = new Set<MIDIInput>();
        const attachInput = (input: MIDIInput) => {
          if (attachedInputs.has(input)) return;
          input.addEventListener("midimessage", handleMIDIMessage);
          attachedInputs.add(input);
          console.info("[midi] input connected", {
            id: input.id,
            name: input.name,
            manufacturer: input.manufacturer,
          });
        };
        const detachInput = (input: MIDIInput) => {
          if (!attachedInputs.has(input)) return;
          input.removeEventListener("midimessage", handleMIDIMessage);
          attachedInputs.delete(input);
          console.info("[midi] input disconnected", {
            id: input.id,
            name: input.name,
          });
        };

        for (const input of midiAccess.inputs.values()) {
          attachInput(input);
        }

        const handleStateChange = (event: MIDIConnectionEvent) => {
          const port = event.port;
          console.info("[midi] statechange", {
            id: port.id,
            name: port.name,
            type: port.type,
            state: port.state,
          });
          if (port.type !== "input") return;
          const input = port as MIDIInput;
          if (port.state === "connected") {
            attachInput(input);
          } else if (port.state === "disconnected") {
            detachInput(input);
          }
        };
        midiAccess.addEventListener("statechange", handleStateChange);

        cleanup = () => {
          midiAccess.removeEventListener("statechange", handleStateChange);
          for (const input of Array.from(attachedInputs)) {
            detachInput(input);
          }
        };
      })
      .catch(console.error);

    return () => cleanup?.();
  }, [noteToCell, ccToTarget, ccToCell, handleCellClick, onCCChangeAction]);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const cellPos = keyToCell.get(e.key.toLowerCase());
      if (cellPos) {
        e.preventDefault();
        handleCellClick(cellPos.row, cellPos.col);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, keyToCell, handleCellClick]);

  const recordingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recordings) {
      if (r.track !== undefined && r.cell !== undefined) {
        const key = `${r.track}-${r.cell}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [recordings]);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {grid.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isActive =
              activeCell?.row === rowIndex && activeCell?.col === colIndex;
            const count = recordingCounts.get(`${rowIndex}-${colIndex}`) || 0;
            const cellFontSize =
              cellFontSizes[`${rowIndex}-${colIndex}`] ?? cell.fontSize;

            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                onClick={() => handleCellClick(rowIndex, colIndex)}
                disabled={!isRecording}
                className={`
                  relative aspect-square flex items-center justify-center
                  text-2xl sm:text-3xl lg:text-4xl
                  border-0 bg-transparent rounded-none transition-all duration-150
                  ${isRecording ? "cursor-pointer hover:scale-105" : "cursor-not-allowed opacity-50"}
                  ${isActive ? "scale-110 bg-purple-500/30" : "bg-transparent"}
                  ${cell.style && isActive ? cell.style : ""}
                `}
              >
                <span
                  className={cell.type === "css" ? "text-sm" : ""}
                  style={
                    cellFontSize !== undefined
                      ? { fontSize: `${cellFontSize / 16}rem` }
                      : undefined
                  }
                >
                  {cell.type === "css" ? cell.content : cell.content}
                </span>
                {count > 0 && (
                  <span className="absolute flex items-center justify-center w-5 h-5 text-xs bg-purple-600 rounded-full top-1 right-1">
                    {count}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {recordings.length > 0 && (
        <div className="flex flex-wrap overflow-y-auto text-xs text-gray-400 gap-1 max-h-20">
          {recordings.slice(-10).map((r, i) => (
            <span key={r.id || i} className="px-2 py-1 bg-gray-700 rounded">
              {formatTimeShort(r.timestamp)} {r.content}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
