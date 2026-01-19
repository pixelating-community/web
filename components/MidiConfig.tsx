"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createMpkMiniCCCellMap,
  createMpkMiniNoteMap,
  FONT_SIZE_RANGE_PX,
} from "@/lib/midiPresets";
import type {
  GridCell,
  KeyboardMapping,
  MidiCCCellMapping,
  MidiCCMapping,
  MidiConfig as MidiConfigType,
  MidiNoteMapping,
} from "@/types/symbol";

type MidiConfigProps = {
  config: MidiConfigType;
  onChange: (config: MidiConfigType) => void;
  onClose: () => void;
};

type LearnTarget =
  | { type: "note"; row: number; col: number }
  | { type: "cc"; target: MidiCCMapping["target"] }
  | { type: "cell-cc"; row: number; col: number }
  | { type: "key"; row: number; col: number }
  | null;

const SYMBOL_PALETTE = [
  { content: "🎵", type: "emoji" as const },
  { content: "🎸", type: "emoji" as const },
  { content: "🥁", type: "emoji" as const },
  { content: "🎹", type: "emoji" as const },
  { content: "🎤", type: "emoji" as const },
  { content: "✨", type: "emoji" as const },
  { content: "🔥", type: "emoji" as const },
  { content: "💫", type: "emoji" as const },
  { content: "⚡", type: "emoji" as const },
  { content: "🌟", type: "emoji" as const },
  { content: "💥", type: "emoji" as const },
  { content: "🎯", type: "emoji" as const },
  { content: "🚀", type: "emoji" as const },
  { content: "💜", type: "emoji" as const },
  { content: "pulse", type: "css" as const, style: "animate-pulse" },
  { content: "bounce", type: "css" as const, style: "animate-bounce" },
  { content: "spin", type: "css" as const, style: "animate-spin" },
  { content: "ping", type: "css" as const, style: "animate-ping" },
  { content: "1", type: "text" as const },
  { content: "2", type: "text" as const },
  { content: "3", type: "text" as const },
  { content: "4", type: "text" as const },
];

const REM_BASE = 16;

const formatDisplayValue = (value: number) => Math.round(value * 100) / 100;

const pxToRem = (value: number) => formatDisplayValue(value / REM_BASE);
const remToPx = (value: number) => value * REM_BASE;

type CCTargetMeta = {
  target: MidiCCMapping["target"];
  label: string;
  defaultMin: number;
  defaultMax: number;
  step: number;
  unit?: string;
  toDisplay?: (value: number) => number;
  fromDisplay?: (value: number) => number;
};

const CC_TARGETS: CCTargetMeta[] = [
  {
    target: "rotation",
    label: "🔄",
    defaultMin: 0,
    defaultMax: 360,
    step: 1,
    unit: "deg",
  },
  {
    target: "fontSize",
    label: "Aa",
    defaultMin: FONT_SIZE_RANGE_PX.min,
    defaultMax: FONT_SIZE_RANGE_PX.max,
    step: 0.1,
    unit: "rem",
    toDisplay: pxToRem,
    fromDisplay: remToPx,
  },
  { target: "opacity", label: "◐", defaultMin: 0, defaultMax: 1, step: 0.01 },
  {
    target: "scale",
    label: "⬡",
    defaultMin: 0.5,
    defaultMax: 2,
    step: 0.01,
    unit: "x",
  },
];

export const MidiConfig = ({ config, onChange, onClose }: MidiConfigProps) => {
  const [learnTarget, setLearnTarget] = useState<LearnTarget>(null);
  const [draggedSymbol, setDraggedSymbol] = useState<GridCell | null>(null);
  const [lastMidiMessage, setLastMidiMessage] = useState<string>("");
  const [newSymbol, setNewSymbol] = useState("");
  const [showPalette, setShowPalette] = useState(false);
  const [showRanges, setShowRanges] = useState(false);
  const midiAccessRef = useRef<MIDIAccess | null>(null);

  const customSymbols = config.customPalette || [];
  const ccCellMap = config.ccCellMap ?? [];

  const addCustomSymbol = useCallback(() => {
    const trimmed = newSymbol.trim();
    if (!trimmed) return;
    onChange({
      ...config,
      customPalette: [...customSymbols, { content: trimmed, type: "emoji" }],
    });
    setNewSymbol("");
  }, [newSymbol, config, customSymbols, onChange]);

  const applyMpkMiniPreset = useCallback(() => {
    const noteMap = createMpkMiniNoteMap(config.grid);
    const nextCCCellMap = createMpkMiniCCCellMap(config.grid);
    onChange({
      ...config,
      noteMap,
      ccCellMap: nextCCCellMap,
      ccMap: [],
    });
  }, [config, onChange]);

  const sortedCCCellMap = useMemo(
    () => [...ccCellMap].sort((a, b) => a.row - b.row || a.col - b.col),
    [ccCellMap],
  );

  const updateCCTargetRange = useCallback(
    (target: MidiCCMapping["target"], key: "min" | "max", value: number) => {
      if (!Number.isFinite(value)) return;
      const meta = CC_TARGETS.find((entry) => entry.target === target);
      if (!meta) return;
      const nextValue = meta.fromDisplay ? meta.fromDisplay(value) : value;
      const nextMap = config.ccMap.map((m) =>
        m.target === target ? { ...m, [key]: nextValue } : m,
      );
      onChange({ ...config, ccMap: nextMap });
    },
    [config, onChange],
  );

  const updateCellCCRange = useCallback(
    (row: number, col: number, key: "min" | "max", value: number) => {
      if (!Number.isFinite(value)) return;
      const nextValue = remToPx(value);
      const nextMap = ccCellMap.map((m) =>
        m.row === row && m.col === col ? { ...m, [key]: nextValue } : m,
      );
      onChange({ ...config, ccCellMap: nextMap });
    },
    [config, ccCellMap, onChange],
  );

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    navigator
      .requestMIDIAccess()
      .then((access) => {
        midiAccessRef.current = access;

        const handleMIDI = (event: MIDIMessageEvent) => {
          if (!event.data || event.data.length < 3) return;
          const [status, data1, data2] = event.data;
          const channel = status & 0x0f;
          const messageType = status & 0xf0;

          if (messageType === 144 && data2 > 0) {
            setLastMidiMessage(`🎹 ${data1} #${channel + 1}`);

            if (learnTarget?.type === "note") {
              const newMapping: MidiNoteMapping = {
                note: data1,
                channel,
                row: learnTarget.row,
                col: learnTarget.col,
              };

              const filtered = config.noteMap.filter(
                (m) =>
                  !(m.row === learnTarget.row && m.col === learnTarget.col),
              );
              onChange({ ...config, noteMap: [...filtered, newMapping] });
              setLearnTarget(null);
            }
          }

          if (messageType === 176) {
            setLastMidiMessage(`🎛️ ${data1}=${data2} #${channel + 1}`);

            if (learnTarget?.type === "cc") {
              const meta = CC_TARGETS.find(
                (entry) => entry.target === learnTarget.target,
              );
              const newMapping: MidiCCMapping = {
                cc: data1,
                channel,
                target: learnTarget.target,
                min: meta?.defaultMin ?? 0,
                max: meta?.defaultMax ?? 1,
              };

              const filtered = config.ccMap.filter(
                (m) => m.target !== learnTarget.target,
              );
              onChange({ ...config, ccMap: [...filtered, newMapping] });
              setLearnTarget(null);
            }

            if (learnTarget?.type === "cell-cc") {
              const newMapping: MidiCCCellMapping = {
                cc: data1,
                channel,
                row: learnTarget.row,
                col: learnTarget.col,
                min: FONT_SIZE_RANGE_PX.min,
                max: FONT_SIZE_RANGE_PX.max,
              };
              const filtered = ccCellMap.filter(
                (m) =>
                  !(m.row === learnTarget.row && m.col === learnTarget.col) &&
                  m.cc !== data1,
              );
              onChange({ ...config, ccCellMap: [...filtered, newMapping] });
              setLearnTarget(null);
            }
          }
        };

        for (const input of access.inputs.values()) {
          input.addEventListener("midimessage", handleMIDI);
        }

        return () => {
          for (const input of access.inputs.values()) {
            input.removeEventListener("midimessage", handleMIDI);
          }
        };
      })
      .catch(console.error);
  }, [learnTarget, config, ccCellMap, onChange]);

  useEffect(() => {
    if (learnTarget?.type !== "key") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLearnTarget(null);
        return;
      }

      const newMapping: KeyboardMapping = {
        key: e.key.toLowerCase(),
        row: learnTarget.row,
        col: learnTarget.col,
      };

      const filtered = config.keyMap.filter(
        (m) => !(m.row === learnTarget.row && m.col === learnTarget.col),
      );
      onChange({ ...config, keyMap: [...filtered, newMapping] });
      setLearnTarget(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [learnTarget, config, onChange]);

  const handleDragStart = useCallback((cell: GridCell) => {
    setDraggedSymbol(cell);
  }, []);

  const handleDrop = useCallback(
    (row: number, col: number) => {
      if (!draggedSymbol) return;

      const newGrid = config.grid.map((r, ri) =>
        r.map((c, ci) => (ri === row && ci === col ? { ...draggedSymbol } : c)),
      );
      onChange({ ...config, grid: newGrid });
      setDraggedSymbol(null);
    },
    [draggedSymbol, config, onChange],
  );

  const getNoteForCell = (row: number, col: number) => {
    return config.noteMap.find((m) => m.row === row && m.col === col);
  };

  const getKeyForCell = (row: number, col: number) => {
    return config.keyMap.find((m) => m.row === row && m.col === col);
  };

  const getCCForTarget = (target: MidiCCMapping["target"]) => {
    return config.ccMap.find((m) => m.target === target);
  };

  const getCCForCell = (row: number, col: number) => {
    return ccCellMap.find((m) => m.row === row && m.col === col);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-transparent max-w-5xl w-full max-h-[90vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-white"
          >
            ✕
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPalette((prev) => !prev)}
              className="px-2.5 py-1 text-xs text-white bg-gray-700 hover:bg-gray-600"
            >
              {showPalette ? "Hide palette" : "Show palette"}
            </button>
            <button
              type="button"
              onClick={() => setShowRanges((prev) => !prev)}
              className="px-2.5 py-1 text-xs text-white bg-gray-700 hover:bg-gray-600"
            >
              {showRanges ? "Hide ranges" : "Show ranges"}
            </button>
            <button
              type="button"
              onClick={applyMpkMiniPreset}
              className="px-3 py-1.5 text-xs text-white bg-gray-700 hover:bg-gray-600"
              title="Apply MPK Mini preset"
            >
              MPK Mini preset
            </button>
          </div>
        </div>

        {lastMidiMessage && (
          <div className="px-2 py-1 mb-3 text-xs text-purple-300 bg-purple-900/50">
            {lastMidiMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {showPalette && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomSymbol()}
                    placeholder="🪏"
                    className="flex-1 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={addCustomSymbol}
                    className="px-3 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-500"
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap p-2 overflow-y-auto gap-2 max-h-32">
                  {[...customSymbols, ...SYMBOL_PALETTE].map((symbol, i) => (
                    <button
                      type="button"
                      key={`${symbol.type}-${symbol.content}-${i}`}
                      draggable
                      onDragStart={() => handleDragStart(symbol)}
                      className="flex items-center justify-center w-10 h-10 text-xl cursor-grab hover:bg-gray-600"
                    >
                      {symbol.type === "css" ? (
                        <span className="text-[10px]">{symbol.content}</span>
                      ) : (
                        symbol.content
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* CC Knob Mappings */}
            <div className="mt-1">
              <h3 className="mb-2 text-sm font-semibold text-gray-300">🎛️</h3>
              <div className="p-2 bg-transparent grid grid-cols-2 gap-2">
                {CC_TARGETS.map(({ target, label, unit, step, toDisplay }) => {
                  const mapping = getCCForTarget(target);
                  const isLearning =
                    learnTarget?.type === "cc" && learnTarget.target === target;
                  const displayMin = mapping
                    ? formatDisplayValue(
                        toDisplay ? toDisplay(mapping.min) : mapping.min,
                      )
                    : undefined;
                  const displayMax = mapping
                    ? formatDisplayValue(
                        toDisplay ? toDisplay(mapping.max) : mapping.max,
                      )
                    : undefined;

                  return (
                    <div
                      key={target}
                      className={`flex items-center justify-between p-2 rounded border ${
                        isLearning
                          ? "border-purple-500 bg-purple-500/30 animate-pulse"
                          : "border-gray-600 bg-gray-700"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white">{label}</div>
                        {mapping && (
                          <div className="text-[11px] text-gray-400">
                            CC{mapping.cc} #
                            {mapping.channel ? mapping.channel + 1 : 1}
                          </div>
                        )}
                        {mapping && showRanges && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-300">
                            <input
                              type="number"
                              step={step}
                              value={displayMin}
                              onChange={(e) =>
                                updateCCTargetRange(
                                  target,
                                  "min",
                                  Number(e.target.value),
                                )
                              }
                              className="w-12 px-1 py-0.5 text-[10px] text-white bg-black/40"
                              title="Min range"
                              aria-label="Min range"
                            />
                            <input
                              type="number"
                              step={step}
                              value={displayMax}
                              onChange={(e) =>
                                updateCCTargetRange(
                                  target,
                                  "max",
                                  Number(e.target.value),
                                )
                              }
                              className="w-12 px-1 py-0.5 text-[10px] text-white bg-black/40"
                              title="Max range"
                              aria-label="Max range"
                            />
                            {unit && (
                              <span className="text-[10px] text-gray-500">
                                {unit}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setLearnTarget({ type: "cc", target })}
                        className={`px-2.5 py-1 text-xs font-medium ${
                          mapping
                            ? "bg-green-600 text-white"
                            : "bg-purple-600 text-white hover:bg-purple-500"
                        }`}
                      >
                        {mapping ? "🔄" : "🎓"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Grid Configuration */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-gray-300">罒</h3>
            <div
              className="p-2 bg-transparent grid gap-1 max-w-[360px] mx-auto"
              style={{
                gridTemplateColumns: `repeat(${config.grid[0]?.length || 4}, minmax(0, 1fr))`,
              }}
            >
              {config.grid.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
                  const noteMapping = getNoteForCell(rowIndex, colIndex);
                  const keyMapping = getKeyForCell(rowIndex, colIndex);
                  const ccCellMapping = getCCForCell(rowIndex, colIndex);
                  const isLearningNote =
                    learnTarget?.type === "note" &&
                    learnTarget.row === rowIndex &&
                    learnTarget.col === colIndex;
                  const isLearningKey =
                    learnTarget?.type === "key" &&
                    learnTarget.row === rowIndex &&
                    learnTarget.col === colIndex;
                  const isLearningCC =
                    learnTarget?.type === "cell-cc" &&
                    learnTarget.row === rowIndex &&
                    learnTarget.col === colIndex;

                  const cellKey = [
                    cell.type,
                    cell.content,
                    noteMapping?.note ?? "n",
                    keyMapping?.key ?? "k",
                    ccCellMapping?.cc ?? "c",
                  ].join("|");

                  return (
                    <div
                      key={cellKey}
                      role="gridcell"
                      tabIndex={0}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(rowIndex, colIndex)}
                      className={`aspect-square flex flex-col items-center justify-center border-2 transition-all ${
                        isLearningNote || isLearningKey || isLearningCC
                          ? "bg-purple-500/30 animate-pulse"
                          : "bg-transparent"
                      }`}
                    >
                      <span className="mb-1 text-xl">
                        {cell.type === "css" ? (
                          <span className="text-[10px]">{cell.content}</span>
                        ) : (
                          cell.content
                        )}
                      </span>
                      <div className="flex text-[10px] gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setLearnTarget({
                              type: "note",
                              row: rowIndex,
                              col: colIndex,
                            })
                          }
                          className={`px-1.5 py-0.5 ${
                            noteMapping
                              ? "bg-green-600 text-white"
                              : "bg-gray-600 text-gray-300"
                          }`}
                          title="Map MIDI Note"
                        >
                          {noteMapping ? `🎹${noteMapping.note}` : "🎹"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLearnTarget({
                              type: "key",
                              row: rowIndex,
                              col: colIndex,
                            })
                          }
                          className={`px-1.5 py-0.5 ${
                            keyMapping
                              ? "bg-blue-600 text-white"
                              : "bg-gray-600 text-gray-300"
                          }`}
                          title="Map Keyboard Key"
                        >
                          {keyMapping ? keyMapping.key.toUpperCase() : "⌨️"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLearnTarget({
                              type: "cell-cc",
                              row: rowIndex,
                              col: colIndex,
                            })
                          }
                          className={`px-1.5 py-0.5 ${
                            ccCellMapping
                              ? "bg-amber-600 text-white"
                              : "bg-gray-600 text-gray-300"
                          }`}
                          title="Map CC to font size"
                        >
                          {ccCellMapping ? `CC${ccCellMapping.cc}` : "Aa"}
                        </button>
                      </div>
                    </div>
                  );
                }),
              )}
            </div>

            {showRanges && sortedCCCellMap.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-xs text-gray-400">Pad font ranges</div>
                <div className="grid grid-cols-2 gap-2">
                  {sortedCCCellMap.map((mapping) => {
                    const displayMin = pxToRem(mapping.min);
                    const displayMax = pxToRem(mapping.max);
                    return (
                      <div
                        key={`cell-cc-${mapping.row}-${mapping.col}`}
                        className="flex items-center justify-between gap-2 px-2 py-1 text-[10px] border border-gray-700 rounded"
                      >
                        <span className="text-gray-300">
                          R{mapping.row + 1}C{mapping.col + 1} CC{mapping.cc}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.1"
                            value={displayMin}
                            onChange={(e) =>
                              updateCellCCRange(
                                mapping.row,
                                mapping.col,
                                "min",
                                Number(e.target.value),
                              )
                            }
                            className="w-12 px-1 py-0.5 text-[10px] text-white bg-black/40"
                            title="Min font size (rem)"
                            aria-label="Min font size (rem)"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={displayMax}
                            onChange={(e) =>
                              updateCellCCRange(
                                mapping.row,
                                mapping.col,
                                "max",
                                Number(e.target.value),
                              )
                            }
                            className="w-12 px-1 py-0.5 text-[10px] text-white bg-black/40"
                            title="Max font size (rem)"
                            aria-label="Max font size (rem)"
                          />
                          <span className="text-[10px] text-gray-500">rem</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-4 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-white bg-gray-700 hover:bg-gray-600"
          >
            ✅
          </button>
        </div>
      </div>
    </div>
  );
};
