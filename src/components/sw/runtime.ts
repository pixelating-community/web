import type { WordTimingEntry } from "@/types/perspectives";

export const DEFAULT_WORD_DURATION = 0.2;
export const AUDIO_TAIL_TRIM_MILLISECONDS = 1;
export const WORD_START_SHIFT_SECONDS = 0.01;
export const TIMING_DRAFTS_STORAGE_KEY = "sw:timing-drafts:v1";
export const STUDIO_PLAYBACK_RATES = [0.25, 0.5, 0.75, 1] as const;

export const MIDI_MARK_NOTES = new Set([37, 45]);
export const MIDI_UNDO_NOTES = new Set([36, 44]);
export const MIDI_FINE_NUDGE_CC = 70;
export const MIDI_FINE_NUDGE_STEP_SECONDS = 0.01;

export type RecordingStatus =
  | "idle"
  | "recording"
  | "uploading"
  | "saving"
  | "error";

export type RecordingState = {
  status: RecordingStatus;
  error?: string;
};

export type PerspectiveRuntimeState = {
  recording?: RecordingState;
  selectedWordIndex?: number;
  localAudioOverride?: string;
  audioOverride?: string;
  audioKeyOverride?: string;
  timings?: WordTimingEntry[];
  timingsRevision?: number;
  lastDraftRevision?: number;
  lastSavedRevision?: number;
  dirtyTimings?: boolean;
  saveSuccess?: boolean;
  analysis?: {
    duration: number;
    waveform: number[];
  };
};

export type PerspectiveRuntimeMap = Record<string, PerspectiveRuntimeState>;

type PerspectiveRuntimeAction = {
  id: string;
  patch: Partial<PerspectiveRuntimeState>;
  type: "patch";
};

export const perspectiveRuntimeReducer = (
  state: PerspectiveRuntimeMap,
  action: PerspectiveRuntimeAction,
): PerspectiveRuntimeMap => {
  if (action.type !== "patch") return state;
  const previous = state[action.id] ?? {};
  const next = { ...previous } as PerspectiveRuntimeState;
  let changed = false;
  for (const [rawKey, value] of Object.entries(action.patch)) {
    const key = rawKey as keyof PerspectiveRuntimeState;
    const nextRecord = next as Record<string, unknown>;
    if (value === undefined) {
      if (key in next) {
        delete nextRecord[key];
        changed = true;
      }
      continue;
    }
    if (nextRecord[key] !== value) {
      nextRecord[key] = value;
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    [action.id]: next,
  };
};

export const isLocalAudioUrl = (value?: string) =>
  Boolean(value) && (value?.startsWith("blob:") || value?.startsWith("data:"));

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const PLAYABLE_API_AUDIO_PATH = "/api/obj";

export const hasPlayableAudioSource = (value?: string) => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return false;
  if (!trimmed.startsWith("/api/")) return true;

  const [pathname, query = ""] = trimmed.split("?");
  if (pathname !== PLAYABLE_API_AUDIO_PATH) return false;
  const params = new URLSearchParams(query);
  const keyParam = params.get("key");
  if (!keyParam) return false;
  const key = decodeURIComponentSafe(keyParam).trim();
  return Boolean(key) && key !== "undefined" && key !== "null";
};

const getFirstTimingStart = (timings: WordTimingEntry[]) => {
  for (const entry of timings) {
    if (!entry || typeof entry !== "object") continue;
    const start = entry.start;
    if (typeof start === "number" && Number.isFinite(start) && start >= 0) {
      return start;
    }
  }
  return null;
};

export const resolvePlaybackClockTime = ({
  time,
  timings,
  trackStartTime,
}: {
  time: number;
  timings: WordTimingEntry[];
  trackStartTime?: number;
}) => {
  if (!Number.isFinite(time) || time < 0) return 0;
  if (
    typeof trackStartTime !== "number" ||
    !Number.isFinite(trackStartTime) ||
    trackStartTime <= 0
  ) {
    return time;
  }
  const firstTimingStart = getFirstTimingStart(timings);
  if (firstTimingStart === null) return time;

  // Legacy payloads can contain starts relative to perspective-local playback,
  // while newer payloads are in absolute audio time.
  const looksRelative =
    firstTimingStart < 0.5 && Math.abs(trackStartTime - firstTimingStart) > 0.5;
  if (!looksRelative) return time;
  return Math.max(0, time - trackStartTime);
};

export const roundToHundredths = (value: number) =>
  Math.round(value * 100) / 100;

export const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  const textLikeTypes = new Set([
    "text",
    "search",
    "url",
    "tel",
    "email",
    "password",
    "number",
  ]);
  const type = target.type?.toLowerCase() || "text";
  return textLikeTypes.has(type);
};

export type MidiMessageEventLike = {
  data?: Uint8Array | null;
};

export type MidiInputLike = {
  id?: string;
  name?: string | null;
  state?: string;
  onmidimessage: ((event: MidiMessageEventLike) => void) | null;
};

export type MidiInputCollectionLike = {
  values: () => IterableIterator<MidiInputLike>;
};

export type MidiAccessLike = {
  inputs: MidiInputCollectionLike;
  onstatechange: (() => void) | null;
};

export type NavigatorWithMidi = Navigator & {
  requestMIDIAccess?: (options?: {
    sysex?: boolean;
  }) => Promise<MidiAccessLike>;
};

export const pickPreferredMidiInput = (inputs: MidiInputLike[]) => {
  const connected = inputs.filter((input) => input.state !== "disconnected");
  if (connected.length === 0) return null;
  return connected.find((input) => /akai|mpk/i.test(input.name ?? "")) ?? null;
};

export const decodeMidiCcDelta = (
  previousValue: number,
  currentValue: number,
) => {
  let absoluteDelta = currentValue - previousValue;
  if (absoluteDelta > 64) absoluteDelta -= 128;
  if (absoluteDelta < -64) absoluteDelta += 128;
  if (absoluteDelta !== 0) return absoluteDelta;

  // Support relative encoder formats when the raw value repeats:
  // - Signed-bit/offset around 64 (e.g. 65=+1, 63=-1)
  // - Two's complement (e.g. 1=+1, 127=-1)
  const signedBitDelta = currentValue === 64 ? 0 : currentValue - 64;
  const twosComplementDelta =
    currentValue === 0
      ? 0
      : currentValue <= 63
        ? currentValue
        : currentValue - 128;
  const candidates = [signedBitDelta, twosComplementDelta].filter(
    (delta) => delta !== 0,
  );
  if (candidates.length === 0) return 0;
  return candidates.reduce((best, next) =>
    Math.abs(next) < Math.abs(best) ? next : best,
  );
};
