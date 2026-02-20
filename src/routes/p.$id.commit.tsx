import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod/v4";
import { NotFoundPage } from "@/components/NotFoundPage";
import {
  clearPendingRecordingAsync,
  getPendingRecordingAsync,
} from "@/components/sw/useSwRecordingStore";
import {
  decodeAudioBlob,
  encodeWav,
  getExtensionForMime,
  mixDownToMono,
} from "@/lib/audioProcessing";
import {
  appendSavedSearchParam,
  commitSearchSchema,
  parseCommitReturnPath,
} from "@/lib/commitRouteSearch";
import { sql } from "@/lib/db";
import { buildTopicPath } from "@/lib/topicRoutes";

type CommitMeta = {
  perspectiveId: string;
  perspectiveText: string;
  topicId: string;
  topicName: string;
};

type CommitRouteLoaderData = {
  data: CommitMeta | null;
  error: string;
};

const isAbortError = (value: unknown) =>
  value instanceof DOMException && value.name === "AbortError";

const loadCommitMeta = createServerFn({ method: "GET" })
  .inputValidator((value: { id?: string }) => value)
  .handler(async ({ data }): Promise<CommitRouteLoaderData> => {
    const id = data.id?.trim() ?? "";
    const schema = z.object({ id: z.uuid() });
    let parsed: { id: string };

    try {
      parsed = schema.parse({ id });
    } catch {
      return { data: null, error: "Invalid id" };
    }

    try {
      const rows = await sql<{
        perspective_id: string;
        perspective_text: string;
        topic_id: string;
        topic_name: string;
      }>`
        SELECT
          p.id AS perspective_id,
          p.perspective AS perspective_text,
          t.id AS topic_id,
          t.name AS topic_name
        FROM perspectives AS p
        JOIN topics AS t ON t.id = p.topic_id
        WHERE p.id = ${parsed.id}
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return { data: null, error: "Perspective not found" };
      }

      const row = rows[0];
      return {
        data: {
          perspectiveId: row.perspective_id,
          perspectiveText: String(row.perspective_text ?? ""),
          topicId: row.topic_id,
          topicName: row.topic_name,
        },
        error: "",
      };
    } catch (error) {
      console.error(error, { message: "Failed to load commit metadata" });
      return { data: null, error: "Failed to load perspective" };
    }
  });

export const Route = createFileRoute("/p/$id/commit")({
  validateSearch: (search) => commitSearchSchema.parse(search),
  loader: ({ params }): Promise<CommitRouteLoaderData> =>
    loadCommitMeta({
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
    return `${buildTopicPath(data.topicName, "w")}?p=${encodeURIComponent(id)}&m=${modeParam}`;
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
      const resolvedContentType =
        contentTypeHint?.trim() ||
        blob.type ||
        "application/octet-stream";
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
          signal,
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
          signal,
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
          // Keep original blob when browser decode/transcode is unavailable.
        }
      }
      const extension = getExtensionForMime(uploadMimeType);
      const filename = `sw-${pendingRecording.perspectiveId}-${Date.now()}.${extension}`;
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

      const alignResponse = await fetch(`/api/p/${id}/align`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alignPayload),
        keepalive: true,
        signal: controller.signal,
      });
      const alignBody = await alignResponse
        .json()
        .catch(() => ({}) as Record<string, unknown>);
      if (!alignResponse.ok) {
        throw new Error(
          typeof alignBody.error === "string"
            ? alignBody.error
            : "Failed to save timings",
        );
      }
      const savedAudioSrc =
        typeof alignBody.audio_src === "string" ? alignBody.audio_src.trim() : "";
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
