"use client";

import type { RefObject } from "react";
import { Audio } from "@/components/Audio";
import { AudioRecorder } from "@/components/AudioRecorder";
import { useConfirmAction } from "@/components/sw/useConfirmAction";
import type { AudioAnalysis } from "@/lib/audioProcessing";
import type { Perspective } from "@/types/perspectives";

type RecordingStatus = "idle" | "recording" | "uploading" | "saving" | "error";

type SWEFooterProps = {
  isViewer: boolean;
  isMinimized?: boolean;
  selectedLabel: string;
  isBusy: boolean;
  hasTimings: boolean;
  isRecentlySaved: boolean;
  studioPlaybackRate: number;
  recordingStatus: RecordingStatus;
  recordingError?: string;
  selectedTimingCount: number;
  selectedWordCount: number;
  selectedWordIndex?: number;
  selectedWord: string;
  currentTrack: Perspective | null;
  selectedAnalysis: AudioAnalysis | null;
  playheadPercent: number;
  isPlaying: boolean;
  audioRef: RefObject<HTMLAudioElement | null>;
  onRecorderStart: (args: { mimeType: string }) => void;
  onRecorderStopIntent?: () => void;
  onRecorderCapture: (args: { blob: Blob; mimeType: string }) => void;
  onRecorderError: (message: string) => void;
  onSaveTimings: () => void;
  onDeleteAudio: () => void;
  onCycleStudioPlaybackRate: () => void;
  onRewindToPrevious: () => void;
  onMarkAndForward: () => void;
  onMarkCurrentEnd: () => void;
  onClearCurrentMark: () => void;
  isClearCurrentMarkArmed?: boolean;
  onClearAllMarks: () => void;
  hasRecordedAudio: boolean;
  onAudioTimeUpdate: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  onShiftWordStartBackward?: () => void;
  onShiftWordStartForward?: () => void;
  wordShiftStepSeconds?: number;
  onToggleMinimized?: () => void;
  onAudioError?: (payload: {
    code: number | null;
    message: string | null;
    src: string;
  }) => void;
};

export const SWEFooter = ({
  isViewer,
  isMinimized = false,
  selectedLabel,
  isBusy,
  hasTimings,
  isRecentlySaved,
  studioPlaybackRate,
  recordingStatus,
  recordingError,
  selectedTimingCount,
  selectedWordCount,
  selectedWordIndex,
  selectedWord,
  currentTrack,
  selectedAnalysis,
  playheadPercent,
  isPlaying,
  audioRef,
  onRecorderStart,
  onRecorderStopIntent,
  onRecorderCapture,
  onRecorderError,
  onSaveTimings,
  onDeleteAudio,
  onCycleStudioPlaybackRate,
  onRewindToPrevious,
  onMarkAndForward,
  onMarkCurrentEnd,
  onClearCurrentMark,
  isClearCurrentMarkArmed = false,
  onClearAllMarks,
  hasRecordedAudio,
  onAudioTimeUpdate,
  setIsPlaying,
  onShiftWordStartBackward,
  onShiftWordStartForward,
  wordShiftStepSeconds = 0.01,
  onToggleMinimized,
  onAudioError,
}: SWEFooterProps) => {
  const confirmDeleteAudio = useConfirmAction({
    enabled: !isBusy && hasRecordedAudio,
    onConfirm: onDeleteAudio,
  });
  const confirmClearAllMarks = useConfirmAction({
    enabled: !isBusy && hasTimings,
    onConfirm: onClearAllMarks,
  });

  const handleDeleteAudioClick = () => {
    if (!confirmDeleteAudio.armed) {
      confirmClearAllMarks.reset();
    }
    confirmDeleteAudio.trigger();
  };

  const handleClearAllMarksClick = () => {
    if (!confirmClearAllMarks.armed) {
      confirmDeleteAudio.reset();
    }
    confirmClearAllMarks.trigger();
  };

  return (
    <div
      className={
        isViewer
          ? "w-full px-4 pb-4"
          : `fixed bottom-0 left-0 right-0 z-30 px-4 ${
              isMinimized ? "pb-2" : "pb-4"
            }`
      }
    >
      <div
        className={
          isViewer
            ? "mx-auto w-full max-w-5xl bg-transparent px-0 py-0"
            : isMinimized
              ? "mx-auto w-full max-w-5xl rounded-xl bg-black/35 px-3 py-1.5 backdrop-blur-md"
              : "mx-auto w-full max-w-5xl rounded-2xl bg-black/20 px-3 py-2 backdrop-blur-md"
        }
      >
        <div
          className={`flex w-full flex-col ${isMinimized ? "gap-1" : "gap-2"}`}
        >
          {!isViewer ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                {selectedLabel}
              </div>
              <button
                type="button"
                onClick={onToggleMinimized}
                className="px-2 py-1 text-[10px] border-0 rounded-full bg-white/10 text-white/75 touch-manipulation"
                aria-label={
                  isMinimized ? "Expand controls" : "Minimize controls"
                }
                aria-expanded={!isMinimized}
                title={isMinimized ? "Expand controls" : "Minimize controls"}
              >
                <span aria-hidden="true">⇕</span>
              </button>
            </div>
          ) : null}
          {!isViewer && !isMinimized && (
            <div className="flex flex-wrap items-center gap-2">
              <AudioRecorder
                disabled={isBusy}
                onStart={onRecorderStart}
                onCapture={onRecorderCapture}
                onError={onRecorderError}
              >
                {({ isRecording, toggle, supported }) => {
                  const isError = recordingStatus === "error" && !isRecording;
                  const label = isRecording
                    ? "Stop recording"
                    : isError
                      ? "Recording failed, tap to retry"
                      : "Record";
                  const icon = isRecording ? "⏹" : isError ? "✗" : "⏺";
                  const buttonClass = isRecording
                    ? "bg-red-500/70 text-white"
                    : isError
                      ? "bg-red-500/45 text-red-50 ring-1 ring-red-300/50"
                      : "bg-white/10 text-white/70";
                  return (
                    <div className="flex h-6 w-8 items-center justify-center">
                      <button
                        type="button"
                        onPointerDown={() => {
                          if (isRecording) {
                            onRecorderStopIntent?.();
                          }
                        }}
                        onClick={toggle}
                        className={`px-3 py-1 text-xs border-0 rounded-full ${buttonClass}`}
                        disabled={isBusy || !supported}
                        aria-label={label}
                        title={label}
                      >
                        {icon}
                      </button>
                    </div>
                  );
                }}
              </AudioRecorder>
              <button
                type="button"
                onClick={handleDeleteAudioClick}
                className={`px-3 py-1 border-0 rounded-full bg-red-500/25 text-red-100 touch-manipulation ${
                  confirmDeleteAudio.armed ? "text-xs" : "text-sm"
                }`}
                disabled={isBusy || !hasRecordedAudio}
                aria-label={
                  confirmDeleteAudio.armed
                    ? "Tap again to remove recorded audio"
                    : "Tap to arm remove recorded audio"
                }
                title={
                  confirmDeleteAudio.armed
                    ? "Tap again to remove recorded audio"
                    : "Tap to arm remove recorded audio"
                }
              >
                {confirmDeleteAudio.armed ? "🚮×1" : "🚮×2"}
              </button>
              <button
                type="button"
                onClick={onSaveTimings}
                className={`px-3 py-1 text-xs border-0 rounded-full transition-colors ${
                  isRecentlySaved
                    ? "bg-emerald-500/45 text-emerald-100"
                    : "bg-white/10 text-white/80"
                }`}
                disabled={isBusy || !hasTimings}
                aria-label="Save timings"
                title="Save timings"
              >
                {isRecentlySaved ? "✓" : "💾"}
              </button>
              <button
                type="button"
                onClick={onCycleStudioPlaybackRate}
                className="px-3 py-1 text-xs border-0 rounded-full bg-white/10 text-white/80 touch-manipulation"
                aria-label={`Playback speed ${studioPlaybackRate}x`}
                title="Toggle playback speed"
              >
                {studioPlaybackRate}x
              </button>
              {recordingStatus === "error" ? (
                <output
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-red-500/25 px-2 py-1 text-[11px] text-red-100"
                  aria-live="polite"
                  title={recordingError ?? "Upload failed"}
                >
                  <span aria-hidden="true">✗</span>
                  <span className="max-w-56 truncate">
                    {recordingError ?? "Upload failed"}
                  </span>
                </output>
              ) : (
                <div className="w-48 text-[11px] text-white/50">
                  {recordingStatus === "uploading"
                    ? "Uploading audio"
                    : recordingStatus === "saving"
                      ? "Saving timings"
                      : recordingStatus === "recording"
                        ? "Recording"
                        : isRecentlySaved
                          ? "Saved"
                          : hasTimings
                            ? `${selectedTimingCount}/${selectedWordCount || selectedTimingCount} timings`
                            : "No timings"}
                </div>
              )}
            </div>
          )}
          {!isViewer && !isMinimized && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onRewindToPrevious}
                className="px-3 py-1 text-sm border-0 h-11 rounded-xl bg-white/10 text-white/85 touch-manipulation"
                disabled={isBusy || selectedWordCount === 0}
                aria-label="Back to previous word mark"
                title="Back to previous word mark"
              >
                ←
              </button>
              <button
                type="button"
                onClick={onMarkAndForward}
                className="px-3 py-1 text-sm border-0 h-11 rounded-xl bg-emerald-500/40 text-emerald-100 touch-manipulation"
                disabled={isBusy || selectedWordCount === 0}
                aria-label="Mark word and move next"
                title="Mark word and move next"
              >
                → 🖍️
              </button>
              <button
                type="button"
                onClick={onMarkCurrentEnd}
                className="px-3 py-1 text-sm border-0 h-11 rounded-xl bg-white/10 text-white/85 touch-manipulation"
                disabled={isBusy || selectedWordCount === 0}
                aria-label="Set end time for current word"
                title="Set end time for current word"
              >
                ↓ End
              </button>
              <button
                type="button"
                onClick={onClearCurrentMark}
                className={`px-3 py-1 border-0 h-11 rounded-xl bg-white/10 text-white/85 touch-manipulation ${
                  isClearCurrentMarkArmed ? "text-xs" : "text-sm"
                }`}
                disabled={isBusy || selectedWordCount === 0}
                aria-label={
                  isClearCurrentMarkArmed
                    ? "Tap again to clear current word mark"
                    : "Tap to arm clear current word mark"
                }
                title={
                  isClearCurrentMarkArmed
                    ? "Tap again to clear current word mark"
                    : "Tap to arm clear current word mark"
                }
              >
                {isClearCurrentMarkArmed ? "↑ 🗑️×1" : "↑ 🗑️×2"}
              </button>
              <button
                type="button"
                onClick={handleClearAllMarksClick}
                className={`col-span-2 px-3 py-1 border-0 h-11 rounded-xl bg-white/10 text-white/85 touch-manipulation sm:col-auto ${
                  confirmClearAllMarks.armed ? "text-xs" : "text-sm"
                }`}
                disabled={isBusy || !hasTimings}
                aria-label={
                  confirmClearAllMarks.armed
                    ? "Tap again to clear all marks"
                    : "Tap to arm clear all marks"
                }
                title={
                  confirmClearAllMarks.armed
                    ? "Tap again to clear all marks"
                    : "Tap to arm clear all marks"
                }
              >
                {confirmClearAllMarks.armed ? "🗑️×1" : "🗑️×2"}
              </button>
            </div>
          )}
          {!isViewer &&
            !isMinimized &&
            selectedWordIndex !== undefined &&
            selectedWordIndex >= 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1 text-[10px] uppercase text-white/50 tracking-[0.2em]">
                <span>Word {selectedWordIndex + 1}</span>
                {selectedWord ? (
                  <span className="max-w-48 truncate text-[11px] normal-case text-white/70 tracking-normal">
                    "{selectedWord}"
                  </span>
                ) : null}
              </div>
            )}
          {currentTrack?.audio_src && (
            <div
              className={
                isMinimized
                  ? "h-0 min-w-0 overflow-hidden opacity-0 pointer-events-none"
                  : "flex-1 min-w-56"
              }
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <Audio
                    ref={audioRef}
                    src={currentTrack.audio_src}
                    startTime={currentTrack.start_time ?? undefined}
                    endTime={currentTrack.end_time ?? undefined}
                    studio={!isViewer && !isMinimized}
                    playbackRate={isViewer ? 1 : studioPlaybackRate}
                    defaultRate={isViewer ? 1 : studioPlaybackRate}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    loop={false}
                    onTimeUpdate={onAudioTimeUpdate}
                    showPlayButton={false}
                    showScrubber={!selectedAnalysis && !isMinimized}
                    seekStepSeconds={wordShiftStepSeconds}
                    onShiftBackward={onShiftWordStartBackward}
                    onShiftForward={onShiftWordStartForward}
                    onPlaybackError={onAudioError}
                  />
                </div>
              </div>
              {!isMinimized && selectedAnalysis && (
                <div className="w-full mt-2">
                  <div className="relative w-full h-10 overflow-hidden rounded-lg bg-white/5">
                    <div className="absolute inset-0 flex items-end px-1 py-1 gap-px">
                      {(() => {
                        const valueCounts = new Map<string, number>();
                        return selectedAnalysis.waveform.map((value) => {
                          const token = value.toFixed(6);
                          const seen = valueCounts.get(token) ?? 0;
                          valueCounts.set(token, seen + 1);
                          const barKey = `wf-${token}-${seen}`;
                          const height = Math.max(8, Math.round(value * 100));
                          return (
                            <div
                              key={barKey}
                              className="w-0.5 rounded-sm bg-white/45"
                              style={{ height: `${height}%` }}
                            />
                          );
                        });
                      })()}
                    </div>
                    <div
                      className="absolute inset-y-0 left-0 w-px bg-purple-300/80 transition-transform duration-100 linear will-change-transform"
                      style={{
                        transform: `translateX(calc(${playheadPercent}% - 0.5px))`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
