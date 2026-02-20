import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { getPerspectiveWords } from "@/components/sw/editorUtils";
import { buildTimingsForRecordedAudio } from "@/components/sw/recordingPolicy";
import {
  AUDIO_TAIL_TRIM_MILLISECONDS,
  type PerspectiveRuntimeMap,
  type PerspectiveRuntimeState,
  type RecordingState,
} from "@/components/sw/runtime";
import {
  buildWaveform,
  decodeAudioBlob,
  encodeWav,
  getExtensionForMime,
  mixDownToMono,
  trimAudioTail,
} from "@/lib/audioProcessing";
import {
  decodeAndProcessWithWorker,
  processDecodedWithWorker,
} from "@/lib/audioWorkerClient";
import { buildTopicUnlockHref } from "@/lib/topicRoutes";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

type PatchRuntime = (
  id: string,
  patch: Partial<PerspectiveRuntimeState>,
) => void;

type UseSwRecordingArgs = {
  runtimeById: PerspectiveRuntimeMap;
  patchRuntime: PatchRuntime;
  selectedPerspective: Perspective | null;
  selectedTimings: WordTimingEntry[];
  audioForSave: (perspective: Perspective) => string;
  clearDraftTimings: (perspectiveId: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
};

export const useSwRecording = ({
  runtimeById,
  patchRuntime,
  selectedPerspective,
  selectedTimings,
  audioForSave,
  clearDraftTimings,
  setIsPlaying,
}: UseSwRecordingArgs) => {
  const queryClient = useQueryClient();
  const recordingIdRef = useRef<string | null>(null);
  const recordingWordsRef = useRef<string[] | null>(null);
  const saveFlashTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});

  useEffect(() => {
    return () => {
      for (const timer of Object.values(saveFlashTimersRef.current)) {
        clearTimeout(timer);
      }
      saveFlashTimersRef.current = {};
    };
  }, []);

  const setRecordingState = useCallback(
    (id: string, next: RecordingState) => {
      patchRuntime(id, { recording: next });
    },
    [patchRuntime],
  );

  const setLocalAudioOverride = useCallback(
    (id: string, blob: Blob) => {
      const url = URL.createObjectURL(blob);
      patchRuntime(id, { localAudioOverride: url });
    },
    [patchRuntime],
  );

  const triggerSaveSuccess = useCallback(
    (id: string) => {
      patchRuntime(id, { saveSuccess: true });
      const existing = saveFlashTimersRef.current[id];
      if (existing) {
        clearTimeout(existing);
      }
      saveFlashTimersRef.current[id] = setTimeout(() => {
        delete saveFlashTimersRef.current[id];
        patchRuntime(id, { saveSuccess: false });
      }, 1500);
    },
    [patchRuntime],
  );

  const uploadRecording = useCallback(
    async ({
      blob,
      contentTypeHint,
      filename,
    }: {
      blob: Blob;
      contentTypeHint?: string;
      filename: string;
    }) => {
      const resolvedContentType =
        contentTypeHint?.trim() || blob.type || "application/octet-stream";
      const canDirectUpload =
        typeof window !== "undefined" &&
        window.location.protocol === "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1";

      const uploadViaForm = async () => {
        const formData = new FormData();
        formData.append("file", blob, filename);
        const response = await fetch("/api/obj/upload", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          throw new Error("Upload failed");
        }
        const payload: { key: string; publicUrl?: string } = await response.json();
        return {
          key: payload.key,
          publicUrl: payload.publicUrl ?? payload.key,
        };
      };

      if (!canDirectUpload) {
        return uploadViaForm();
      }

      try {
        const response = await fetch("/api/obj/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename,
            contentType: resolvedContentType,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to request upload");
        }
        const payload: { key: string; publicUrl?: string; uploadUrl: string } =
          await response.json();
        const putResponse = await fetch(payload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": resolvedContentType },
          body: blob,
        });
        if (!putResponse.ok) {
          throw new Error("Upload failed");
        }
        return {
          key: payload.key,
          publicUrl: payload.publicUrl ?? payload.key,
        };
      } catch {
        return uploadViaForm();
      }
    },
    [],
  );

  const saveTimings = useCallback(
    async (
      id: string,
      timings: WordTimingEntry[],
      audioSrc: string | null,
      duration?: number,
    ) => {
      const payload: Record<string, unknown> = { timings };
      if (
        typeof duration === "number" &&
        Number.isFinite(duration) &&
        duration > 0
      ) {
        payload.duration = duration;
      }
      if (audioSrc === null) {
        payload.clearAudio = true;
      } else {
        const trimmedAudioSrc = audioSrc.trim();
        if (!trimmedAudioSrc) {
          throw new Error("Missing audio source");
        }
        if (
          trimmedAudioSrc.startsWith("http://") ||
          trimmedAudioSrc.startsWith("https://")
        ) {
          payload.audioUrl = trimmedAudioSrc;
        } else if (trimmedAudioSrc.startsWith("/")) {
          payload.audioUrl = `${window.location.origin}${trimmedAudioSrc}`;
        } else {
          payload.audioKey = trimmedAudioSrc;
        }
      }

      const res = await fetch(`/api/p/${id}/align`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify(payload),
      });
      const data = await res
        .json()
        .catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        if (data?.code === "TOPIC_LOCKED" && typeof window !== "undefined") {
          const topicMatch = window.location.pathname.match(/^\/t\/([^/]+)/);
          const topicName = topicMatch?.[1]
            ? decodeURIComponent(topicMatch[1])
            : "";
          if (topicName) {
            const nextPath = `${window.location.pathname}${window.location.search}`;
            window.location.assign(
              buildTopicUnlockHref({
                topicName,
                nextPath,
              }),
            );
          }
        }
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Failed to save timings",
        );
      }
      return data as {
        timings?: WordTimingEntry[];
        audio_src?: string;
        start_time?: number | null;
        end_time?: number | null;
      };
    },
    [],
  );

  const handleRecorderStart = useCallback(
    ({ mimeType: _mimeType }: { mimeType: string }) => {
      if (!selectedPerspective) return;
      recordingIdRef.current = selectedPerspective.id;
      recordingWordsRef.current = getPerspectiveWords(selectedPerspective);
      setRecordingState(selectedPerspective.id, { status: "recording" });
      setIsPlaying(false);
    },
    [selectedPerspective, setRecordingState, setIsPlaying],
  );

  const handleRecorderError = useCallback(
    (message: string) => {
      const perspectiveId = recordingIdRef.current ?? selectedPerspective?.id;
      if (!perspectiveId) return;
      recordingIdRef.current = null;
      recordingWordsRef.current = null;
      setRecordingState(perspectiveId, { status: "error", error: message });
    },
    [selectedPerspective, setRecordingState],
  );

  const handleRecorderStopIntent = useCallback(() => {}, []);

  const handleRecorderCapture = useCallback(
    async ({ blob, mimeType }: { blob: Blob; mimeType: string }) => {
      const perspectiveId = recordingIdRef.current ?? selectedPerspective?.id;
      const words =
        recordingWordsRef.current ??
        (selectedPerspective ? getPerspectiveWords(selectedPerspective) : []);
      recordingIdRef.current = null;
      recordingWordsRef.current = null;

      if (!perspectiveId) return;
      if (blob.size === 0) {
        setRecordingState(perspectiveId, {
          status: "error",
          error: "No audio captured",
        });
        return;
      }

      const nextTimings = buildTimingsForRecordedAudio(words);
      const runtimeState = runtimeById[perspectiveId];
      const nextRevision = (runtimeState?.timingsRevision ?? 0) + 1;
      patchRuntime(perspectiveId, {
        timings: nextTimings,
        timingsRevision: nextRevision,
        dirtyTimings: false,
      });
      setLocalAudioOverride(perspectiveId, blob);

      let analysisDuration = 0;
      let waveform: number[] | null = null;
      try {
        // Phase 2: try full off-main-thread decode+process first.
        const workerDecoded = await decodeAndProcessWithWorker({
          blob,
          bars: 120,
          trimEndMilliseconds: AUDIO_TAIL_TRIM_MILLISECONDS,
        });
        analysisDuration = workerDecoded.duration;
        waveform = workerDecoded.waveform;
      } catch {
        try {
          // Phase 1 fallback: decode on main thread, but keep heavy processing off-thread.
          const buffer = await decodeAudioBlob(blob);
          const channels = Array.from(
            { length: buffer.numberOfChannels },
            (_, index) => new Float32Array(buffer.getChannelData(index)),
          );
          const workerProcessed = await processDecodedWithWorker({
            sampleRate: buffer.sampleRate,
            channels,
            bars: 120,
            trimEndMilliseconds: AUDIO_TAIL_TRIM_MILLISECONDS,
          });
          analysisDuration = workerProcessed.duration;
          waveform = workerProcessed.waveform;
        } catch {
          try {
            // Final compatibility fallback for browsers without reliable worker audio support.
            const buffer = await decodeAudioBlob(blob);
            const mono = trimAudioTail({
              samples: mixDownToMono(buffer),
              sampleRate: buffer.sampleRate,
              trimMilliseconds: AUDIO_TAIL_TRIM_MILLISECONDS,
            });
            analysisDuration =
              buffer.sampleRate > 0 ? mono.length / buffer.sampleRate : 0;
            waveform = buildWaveform(mono, 120);
          } catch {
            // If decode fails, keep recording and upload raw captured audio.
          }
        }
      }

      if (waveform && analysisDuration > 0) {
        patchRuntime(perspectiveId, {
          analysis: {
            duration: analysisDuration,
            waveform,
          },
        });
      }
      setRecordingState(perspectiveId, { status: "uploading" });
      try {
        const pendingMimeType = mimeType?.trim() || blob.type || "audio/webm";
        let uploadBlob = blob;
        let uploadMimeType = pendingMimeType;
        if (uploadMimeType.includes("webm")) {
          try {
            const decoded = await decodeAudioBlob(uploadBlob);
            const wavBlob = encodeWav(
              mixDownToMono(decoded),
              decoded.sampleRate,
            );
            uploadBlob = wavBlob;
            uploadMimeType = wavBlob.type || "audio/wav";
          } catch {
            // Keep the original blob when browser transcode is unavailable.
          }
        }
        const extension = getExtensionForMime(uploadMimeType);
        const filename = `sw-${perspectiveId}-${Date.now()}.${extension}`;
        const upload = await uploadRecording({
          blob: uploadBlob,
          filename,
          contentTypeHint: uploadMimeType,
        });

        setRecordingState(perspectiveId, { status: "saving" });
        const result = await saveTimings(
          perspectiveId,
          nextTimings,
          upload.key,
          analysisDuration > 0 ? analysisDuration : undefined,
        );
        const persistedTimings = result.timings ?? nextTimings;
        const resolvedAudioSrc = result.audio_src?.trim() || upload.key;
        clearDraftTimings(perspectiveId);
        patchRuntime(perspectiveId, {
          recording: { status: "idle" },
          timings: persistedTimings,
          lastSavedRevision: nextRevision,
          lastDraftRevision: nextRevision,
          dirtyTimings: false,
          audioOverride: resolvedAudioSrc,
          audioKeyOverride:
            resolvedAudioSrc &&
            !resolvedAudioSrc.startsWith("http") &&
            !resolvedAudioSrc.startsWith("/")
              ? resolvedAudioSrc
              : undefined,
        });
        triggerSaveSuccess(perspectiveId);
        void queryClient.invalidateQueries({
          queryKey: ["topic-payload"],
        });
      } catch (error) {
        setRecordingState(perspectiveId, {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to process recording",
        });
      }
    },
    [
      clearDraftTimings,
      patchRuntime,
      queryClient,
      runtimeById,
      saveTimings,
      selectedPerspective,
      setLocalAudioOverride,
      setRecordingState,
      triggerSaveSuccess,
      uploadRecording,
    ],
  );

  const persistTimingsForPerspective = useCallback(
    async (perspective: Perspective, timings: WordTimingEntry[]) => {
      const audioSrc = audioForSave(perspective);
      if (!audioSrc) {
        throw new Error("No audio to save");
      }
      const duration = runtimeById[perspective.id]?.analysis?.duration;
      const result = await saveTimings(
        perspective.id,
        timings,
        audioSrc,
        duration,
      );
      if (result.audio_src) {
        const resolvedAudioSrc = result.audio_src.trim();
        const resolvedAudioOverride = resolvedAudioSrc || audioSrc;
        patchRuntime(perspective.id, {
          audioOverride: resolvedAudioOverride,
        });
        if (
          resolvedAudioOverride &&
          !resolvedAudioOverride.startsWith("http") &&
          !resolvedAudioOverride.startsWith("/")
        ) {
          patchRuntime(perspective.id, {
            audioKeyOverride: resolvedAudioOverride,
          });
        }
      }
      const persistedTimings = result.timings ?? timings;
      patchRuntime(perspective.id, { timings: persistedTimings });
      return { audioSrc, timings: persistedTimings };
    },
    [audioForSave, patchRuntime, runtimeById, saveTimings],
  );

  const handleDeleteAudio = useCallback(async () => {
    if (!selectedPerspective) return;
    const perspectiveId = selectedPerspective.id;
    setIsPlaying(false);
    setRecordingState(perspectiveId, { status: "saving" });
    patchRuntime(perspectiveId, {
      localAudioOverride: undefined,
      audioOverride: "",
      audioKeyOverride: "",
      analysis: undefined,
    });
    try {
      const result = await saveTimings(perspectiveId, selectedTimings, null);
      const revision = runtimeById[perspectiveId]?.timingsRevision ?? 0;
      clearDraftTimings(perspectiveId);
      patchRuntime(perspectiveId, {
        recording: { status: "idle" },
        timings: result.timings ?? selectedTimings,
        lastSavedRevision: revision,
        lastDraftRevision: revision,
        dirtyTimings: false,
        localAudioOverride: undefined,
        audioOverride: "",
        audioKeyOverride: "",
        analysis: undefined,
      });
      triggerSaveSuccess(perspectiveId);
    } catch (err) {
      setRecordingState(perspectiveId, {
        status: "error",
        error: err instanceof Error ? err.message : "Failed to remove audio",
      });
    }
  }, [
    clearDraftTimings,
    patchRuntime,
    runtimeById,
    saveTimings,
    selectedPerspective,
    selectedTimings,
    setIsPlaying,
    setRecordingState,
    triggerSaveSuccess,
  ]);

  const handleSaveTimings = useCallback(async () => {
    if (!selectedPerspective) return;
    setRecordingState(selectedPerspective.id, { status: "saving" });
    try {
      await persistTimingsForPerspective(selectedPerspective, selectedTimings);
      const revision =
        runtimeById[selectedPerspective.id]?.timingsRevision ?? 0;
      clearDraftTimings(selectedPerspective.id);
      patchRuntime(selectedPerspective.id, {
        recording: { status: "idle" },
        lastSavedRevision: revision,
        lastDraftRevision: revision,
        dirtyTimings: false,
      });
      triggerSaveSuccess(selectedPerspective.id);
    } catch (err) {
      setRecordingState(selectedPerspective.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Failed to save timings",
      });
    }
  }, [
    clearDraftTimings,
    patchRuntime,
    persistTimingsForPerspective,
    runtimeById,
    selectedPerspective,
    selectedTimings,
    setRecordingState,
    triggerSaveSuccess,
  ]);

  return {
    handleRecorderStart,
    handleRecorderStopIntent,
    handleRecorderError,
    handleRecorderCapture,
    handleSaveTimings,
    handleDeleteAudio,
  };
};
