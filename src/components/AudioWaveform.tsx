"use client";

const DEFAULT_WAVEFORM = [
  28, 40, 68, 54, 24, 36, 78, 92, 50, 44, 62, 30, 58, 84, 72, 34, 26, 48, 86,
  64, 42, 74, 96, 66, 38, 52, 80, 58, 32, 46, 70, 90,
];

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export const normalizeWaveformBars = (
  waveform?: readonly number[] | null,
  fallback: readonly number[] = DEFAULT_WAVEFORM,
) => {
  const values = waveform?.length ? waveform : fallback;
  return values
    .map((value) => {
      if (!Number.isFinite(value)) return null;
      const percent = value <= 1 ? value * 100 : value;
      return Math.min(100, Math.max(8, Math.round(percent)));
    })
    .filter((value): value is number => value !== null);
};

type AudioWaveformProps = {
  barClassName?: string;
  barWidthClassName?: string;
  barsClassName?: string;
  className?: string;
  fallbackWaveform?: readonly number[];
  playheadPercent?: number;
  playheadClassName?: string;
  selectionClassName?: string;
  selectionLeftPercent?: number;
  selectionWidthPercent?: number;
  waveform?: readonly number[] | null;
};

export function AudioWaveform({
  barClassName = "bg-[color-mix(in_oklch,var(--color-neon-teal),transparent_45%)]",
  barWidthClassName = "w-full",
  barsClassName = "px-2 py-2",
  className = "h-14 rounded-lg bg-black/30",
  fallbackWaveform,
  playheadPercent,
  playheadClassName = "bg-[var(--color-neon-magenta)]",
  selectionClassName = "border-[var(--color-neon-teal)] bg-[color-mix(in_oklch,var(--color-neon-teal),transparent_78%)]",
  selectionLeftPercent,
  selectionWidthPercent,
  waveform,
}: AudioWaveformProps) {
  const bars = normalizeWaveformBars(waveform, fallbackWaveform);
  const hasSelection =
    typeof selectionLeftPercent === "number" &&
    typeof selectionWidthPercent === "number";
  const hasPlayhead = typeof playheadPercent === "number";

  return (
    <div aria-hidden="true" className={`relative overflow-hidden ${className}`}>
      <div
        className={`absolute inset-0 flex items-end gap-px ${barsClassName}`}
      >
        {bars.map((height, index) => (
          <span
            key={`wave-${height}-${index}`}
            className={`${barWidthClassName} rounded-sm ${barClassName}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      {hasSelection ? (
        <div
          aria-hidden="true"
          className={`absolute top-1 bottom-1 rounded-md border ${selectionClassName}`}
          style={{
            left: `${clampPercent(selectionLeftPercent)}%`,
            width: `${clampPercent(selectionWidthPercent)}%`,
          }}
        />
      ) : null}
      {hasPlayhead ? (
        <div
          aria-hidden="true"
          className={`absolute top-0 h-full w-0.5 ${playheadClassName}`}
          style={{ left: `${clampPercent(playheadPercent)}%` }}
        />
      ) : null}
    </div>
  );
}
