import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import {
  clearPendingRecordingAsync,
  getPendingRecordingAsync,
} from "@/components/sw/useSwRecordingStore";
import {
  decodeAudioBlob,
  encodeDualMonoWav,
  getExtensionForMime,
  hasSevereStereoImbalance,
  mixDownToMono,
} from "@/lib/audioProcessing";
import {
  appendSavedSearchParam,
  commitSearchSchema,
  parseCommitReturnPath,
} from "@/lib/commitRouteSearch";
import { savePerspectiveAlignment } from "@/lib/perspectiveAlignment.functions";
import { loadPerspectiveCommitMeta } from "@/lib/perspectiveCommitRoute.functions";
import type { CommitRouteLoaderData } from "@/lib/perspectiveCommitRoute.server";
import { buildTopicPath } from "@/lib/topicRoutes";

const isAbortError = (value: unknown) =>
  value instanceof DOMException && value.name === "AbortError";

export const Route = createFileRoute("/p/$id/commit")({
  validateSearch: (search) => commitSearchSchema.parse(search),
  loader: ({ params }): Promise<CommitRouteLoaderData> =>
    loadPerspectiveCommitMeta({
      data: { id: params.id },
    }),
  pendingComponent: CommitPending,
  component: CommitRoute,
});

function CommitPending() {
  return (
    <main className="flex h-dvh w-full items-center justify-center">
      <div className="text-sm text-white/80">processing...</div>
    </main>
  );
}

type CommitStatus = "uploading" | "aligning" | "paused" | "success" | "error";

function CommitRoute() {
  const { id } = Route.useParams();
  const { data, error } = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const savePerspectiveAlignmentFn = useServerFn(savePerspectiveAlignment);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CommitStatus>("uploading");
  const [statusMessage, setStatusMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeStageRef = useRef<"uploading" | "aligning">("uploading");
  const backgroundedRef = useRef(false);
  const isDisposedRef = useRef(false);
  const isNotFound = error.trim().toLowerCase() === "perspective not found";
  const recordingId = search.r?.trim() ?? "";
  const modeParam = search.m === "s" ? "s" : "1";
  const fallbackReturnPath = useMemo(() => {
    if (!data?.topicName) return `/p/${id}`;
    return `${buildTopicPath(data.topicName)}?r=${encodeURIComponent(id)}&m=${modeParam}`;
  }, [data?.topicName, id, modeParam]);
  const returnPath = useMemo(() => {
    return parseCommitReturnPath({
      fallbackPath: fallbackReturnPath,
      rawReturn: search.return,
    });
  }, [fallbackReturnPath, search.return]);

  const emitRecordingEvent = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      console.info("[recording-flow]", {
        event,
        perspectiveId: id,
        ...payload,
      });
    },
    [id],
  );

  const uploadRecording = useCallback(
    async ({
      blob,
      filename,
      contentTypeHint,
      signal,
    }: {
      blob: Blob;
      filename: string;
      contentTypeHint?: string;
      signal: AbortSignal;
    }) => {
      const formData = new FormData();
      formData.append("file", blob, filename);
      if (contentTypeHint?.trim()) {
        formData.append("contentTypeHint", contentTypeHint.trim());
      }
      const response = await fetch("/api/obj/upload", {
        method: "POST",
        body: formData,
        signal,
      });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      const payload: { key: string; publicUrl?: string } =
        await response.json();
      return {
        key: payload.key,
        publicUrl: payload.publicUrl ?? payload.key,
      };
    },
    [],
  );

  const runCommit = useCallback(async () => {
    if (!data || !recordingId) {
      setStatus("error");
      setStatusMessage("Recording data unavailable. Please record again.");
      return;
    }

    const pendingRecording = await getPendingRecordingAsync(recordingId);
    if (!pendingRecording || pendingRecording.perspectiveId !== id) {
      setStatus("error");
      setStatusMessage("Recording data unavailable. Please record again.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    backgroundedRef.current = false;

    try {
      activeStageRef.current = "uploading";
      setStatus("uploading");
      setStatusMessage("");
      emitRecordingEvent("rec_upload_start", {
        recordingId,
        bytes: pendingRecording.blob.size,
      });
      const pendingMimeType =
        pendingRecording.mimeType?.trim() ||
        pendingRecording.blob.type ||
        "audio/webm";
      let uploadBlob = pendingRecording.blob;
      let uploadMimeType = pendingMimeType;
      if (
        uploadMimeType.includes("webm") ||
        uploadMimeType.includes("mp4") ||
        uploadMimeType.includes("m4a") ||
        uploadMimeType.includes("ogg")
      ) {
        try {
          const decoded = await decodeAudioBlob(uploadBlob);
          if (hasSevereStereoImbalance(decoded)) {
            const mono = mixDownToMono(decoded);
            const wavBlob = encodeDualMonoWav(mono, decoded.sampleRate);
            uploadBlob = wavBlob;
            uploadMimeType = wavBlob.type || "audio/wav";
          }
        } catch {
          // Keep original blob when browser decode/transcode is unavailable.
        }
      }
      const extension = getExtensionForMime(uploadMimeType);
      const filename = `studio-${pendingRecording.perspectiveId}-${Date.now()}.${extension}`;
      const upload = await uploadRecording({
        blob: uploadBlob,
        filename,
        contentTypeHint: uploadMimeType,
        signal: controller.signal,
      });

      activeStageRef.current = "aligning";
      setStatus("aligning");
      emitRecordingEvent("rec_align_start", { recordingId });
      const alignPayload: Record<string, unknown> = {
        timings: pendingRecording.timings,
      };
      if (
        typeof pendingRecording.duration === "number" &&
        pendingRecording.duration > 0
      ) {
        alignPayload.duration = pendingRecording.duration;
      }
      alignPayload.audioKey = upload.key;

      const alignResult = await savePerspectiveAlignmentFn({
        data: {
          actionToken: data.actionToken,
          ...(typeof alignPayload.duration === "number"
            ? { duration: alignPayload.duration }
            : {}),
          audioKey: upload.key,
          perspectiveId: id,
          timings: pendingRecording.timings,
          topicId: data.topicId,
        },
      });
      if (!alignResult.ok) {
        throw new Error(
          typeof alignResult.error === "string"
            ? alignResult.error
            : "Failed to save timings",
        );
      }
      const savedAudioSrc =
        typeof alignResult.data.audio_src === "string"
          ? alignResult.data.audio_src.trim()
          : "";
      if (!savedAudioSrc) {
        throw new Error(
          "Audio upload was not confirmed. Staying on commit page.",
        );
      }

      await clearPendingRecordingAsync(recordingId);
      await queryClient.invalidateQueries({
        queryKey: ["topic-payload"],
      });
      if (isDisposedRef.current) return;
      setStatus("success");
      const destination = appendSavedSearchParam(returnPath);
      emitRecordingEvent("rec_return_success", {
        recordingId,
        returnPath: destination,
      });
      await router.navigate({
        href: destination,
        replace: true,
      });
    } catch (error) {
      if (isDisposedRef.current) {
        return;
      }
      if (isAbortError(error) || backgroundedRef.current) {
        setStatus("paused");
        setStatusMessage("Upload paused. Tap resume.");
        emitRecordingEvent("rec_upload_bg", {
          recordingId,
          stage: activeStageRef.current,
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to process recording";
      setStatus("error");
      setStatusMessage(message);
      emitRecordingEvent(
        activeStageRef.current === "aligning"
          ? "rec_align_fail"
          : "rec_upload_fail",
        {
          recordingId,
          message,
        },
      );
    } finally {
      abortControllerRef.current = null;
    }
  }, [
    data,
    emitRecordingEvent,
    id,
    queryClient,
    recordingId,
    returnPath,
    router,
    savePerspectiveAlignmentFn,
    uploadRecording,
  ]);

  useEffect(() => {
    void runCommit();
  }, [runCommit]);

  useEffect(() => {
    isDisposedRef.current = false;
    return () => {
      isDisposedRef.current = true;
      backgroundedRef.current = true;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      if (status !== "uploading" && status !== "aligning") return;
      backgroundedRef.current = true;
      abortControllerRef.current?.abort();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [status]);

  if (isNotFound) {
    return <NotFoundPage />;
  }

  if (error || !data) {
    return (
      <main className="flex h-dvh w-full items-center justify-center px-4">
        <div className="text-sm text-red-200">
          {error || "Perspective not found"}
        </div>
      </main>
    );
  }

  const showRetry = status === "paused" || status === "error";
  const returnButtonLabel = status === "error" ? "🎙️×2 Record again" : "Back";

  return (
    <main className="relative flex h-dvh w-full flex-col items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-black/35 p-5 backdrop-blur-md">
        <div className="mt-3 text-center text-9xl leading-none" aria-label="Recording disc">
          <span aria-hidden="true">💽</span>
        </div>
        {statusMessage && showRetry ? (
          <p className="mt-2 text-xs text-red-200">{statusMessage}</p>
        ) : null}
        {showRetry ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatus("uploading");
                setStatusMessage("");
                void runCommit();
              }}
              className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/90 transition hover:border-white/40"
            >
              Resume Upload
            </button>
            <button
              type="button"
              onClick={() => {
                void router.navigate({
                  href: returnPath,
                  replace: true,
                });
              }}
              className="rounded-full border border-white/15 bg-transparent px-3 py-1 text-xs text-white/70 transition hover:border-white/30 hover:text-white"
            >
              {returnButtonLabel}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
