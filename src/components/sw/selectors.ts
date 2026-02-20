import { getPerspectiveWords } from "@/components/sw/editorUtils";
import {
  hasPlayableAudioSource,
  isLocalAudioUrl,
  resolvePlaybackClockTime,
  type PerspectiveRuntimeMap,
  type PerspectiveRuntimeState,
} from "@/components/sw/runtime";
import { resolvePublicAudioSrc } from "@/lib/publicAudioBase";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";
import type { AudioPlaybackError, PlaybackTrackBounds } from "@/components/sw/types";

export const selectSelectedPerspective = ({
  perspectives,
  selectedId,
}: {
  perspectives: Perspective[];
  selectedId: string;
}) =>
  perspectives.find((perspective) => perspective.id === selectedId) ??
  perspectives[0] ??
  null;

export const selectPerspectiveAudioValue = ({
  perspective,
  runtimeById,
}: {
  perspective: Perspective;
  runtimeById: PerspectiveRuntimeMap;
}) => {
  const runtime = runtimeById[perspective.id];
  return (
    runtime?.localAudioOverride ??
    runtime?.recordingOverride ??
    perspective.recording_src ??
    runtime?.audioOverride ??
    perspective.audio_src ??
    ""
  );
};

export const resolveSwAudioSource = (value: string | undefined) =>
  resolvePublicAudioSrc(value);

export const hasRuntimeAudioOverride = (
  runtime?: PerspectiveRuntimeState,
) =>
  Boolean(
    runtime?.localAudioOverride ??
      runtime?.audioOverride ??
      runtime?.audioKeyOverride,
  );

export const selectTrackBounds = ({
  perspective,
  runtime,
  usesDatabaseBounds,
}: {
  perspective: Perspective;
  runtime?: PerspectiveRuntimeState;
  usesDatabaseBounds: boolean;
}): PlaybackTrackBounds => {
  if (!hasRuntimeAudioOverride(runtime) && usesDatabaseBounds) {
    return {
      start: perspective.start_time ?? 0,
      end: perspective.end_time ?? undefined,
    };
  }
  return {
    start: 0,
    end: undefined,
  };
};

export const selectNextPlayablePerspective = ({
  activePerspectiveId,
  perspectives,
  runtimeById,
}: {
  activePerspectiveId: string;
  perspectives: Perspective[];
  runtimeById: PerspectiveRuntimeMap;
}) => {
  const activeIndex = perspectives.findIndex(
    (perspective) => perspective.id === activePerspectiveId,
  );
  if (activeIndex < 0) return null;
  for (let index = activeIndex + 1; index < perspectives.length; index++) {
    const candidate = perspectives[index];
    const candidateSrc = resolveSwAudioSource(
      selectPerspectiveAudioValue({
        perspective: candidate,
        runtimeById,
      }),
    );
    if (hasPlayableAudioSource(candidateSrc)) {
      return candidate;
    }
  }
  return null;
};

export const selectAudioValueForSave = ({
  perspective,
  runtimeById,
  hasAudioBase,
}: {
  perspective: Perspective;
  runtimeById: PerspectiveRuntimeMap;
  hasAudioBase: boolean;
}) => {
  const runtime = runtimeById[perspective.id];
  const override = runtime?.audioOverride;
  const stored = perspective.audio_src;
  const safeOverride = isLocalAudioUrl(override) ? undefined : override;
  const safeStored = isLocalAudioUrl(stored) ? undefined : stored;
  const musicValue = hasAudioBase
    ? (runtime?.audioKeyOverride ?? safeOverride ?? safeStored ?? "")
    : (safeOverride ?? safeStored ?? runtime?.audioKeyOverride ?? "");
  if (musicValue) return musicValue;
  // Fall back to the recording source when there is no music track
  const recordingOverride = runtime?.recordingOverride;
  const storedRecording = perspective.recording_src;
  return (isLocalAudioUrl(recordingOverride) ? undefined : recordingOverride) ??
    (isLocalAudioUrl(storedRecording) ? undefined : storedRecording) ??
    "";
};

export const selectPerspectiveTimings = ({
  perspective,
  runtimeById,
}: {
  perspective: Perspective;
  runtimeById: PerspectiveRuntimeMap;
}) => {
  const sourceTimings =
    runtimeById[perspective.id]?.timings ?? perspective.wordTimings ?? [];
  const words = getPerspectiveWords(perspective);
  if (words.length === 0) return sourceTimings;
  return Array.from({ length: words.length }, (_, index) => {
    const entry = sourceTimings[index];
    return entry === undefined ? null : entry;
  });
};

export const selectPlaybackErrorSummary = (
  error?: AudioPlaybackError | null,
) =>
  error
    ? [
        error.code !== null ? `code ${error.code}` : null,
        error.message?.trim() || null,
      ]
        .filter(Boolean)
        .join(" - ")
    : "";

export const selectSelectedAudioSrc = ({
  selectedPerspective,
  runtimeById,
}: {
  selectedPerspective: Perspective | null;
  runtimeById: PerspectiveRuntimeMap;
}) =>
  selectedPerspective
    ? resolveSwAudioSource(
        selectPerspectiveAudioValue({
          perspective: selectedPerspective,
          runtimeById,
        }),
      )
    : "";

export const selectPlaybackClock = ({
  time,
  timings,
  usesDatabaseBounds,
  perspectiveStartTime,
}: {
  time: number;
  timings: WordTimingEntry[];
  usesDatabaseBounds: boolean;
  perspectiveStartTime?: number;
}) =>
  resolvePlaybackClockTime({
    time,
    timings,
    trackStartTime: usesDatabaseBounds ? perspectiveStartTime : undefined,
  });

export const selectTimingCount = (timings: WordTimingEntry[]) =>
  timings.filter(Boolean).length;

export const selectPerspectiveWords = (perspective: Perspective | null) =>
  perspective ? getPerspectiveWords(perspective) : [];

export const selectWordCount = (perspective: Perspective | null) =>
  selectPerspectiveWords(perspective).length;

export const selectSelectedWord = ({
  selectedWords,
  selectedWordIndex,
}: {
  selectedWords: string[];
  selectedWordIndex?: number;
}) =>
  selectedWordIndex !== undefined && selectedWordIndex >= 0
    ? selectedWords[selectedWordIndex] ?? ""
    : "";

export const selectCurrentTrack = ({
  selectedPerspective,
  selectedAudioSrc,
  hasSelectedAudio,
  hasSelectedAudioOverride,
  usesDatabaseBounds,
}: {
  selectedPerspective: Perspective | null;
  selectedAudioSrc: string;
  hasSelectedAudio: boolean;
  hasSelectedAudioOverride: boolean;
  usesDatabaseBounds: boolean;
}) => {
  if (!selectedPerspective || !hasSelectedAudio) return null;
  if (!hasSelectedAudioOverride && usesDatabaseBounds) {
    return {
      ...selectedPerspective,
      audio_src: selectedAudioSrc,
    };
  }
  return {
    ...selectedPerspective,
    audio_src: selectedAudioSrc,
    start_time: 0,
    end_time: undefined,
  };
};

export const selectAnalysis = (runtime?: PerspectiveRuntimeState) =>
  runtime?.analysis ?? null;

export const selectPlayheadPercent = ({
  analysis,
  playbackClockTime,
}: {
  analysis?: PerspectiveRuntimeState["analysis"] | null;
  playbackClockTime: number;
}) =>
  analysis && analysis.duration > 0
    ? Math.min(100, (playbackClockTime / analysis.duration) * 100)
    : 0;
