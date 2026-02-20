import { useCallback, useEffect, useRef } from "react";
import type {
  PerspectiveRuntimeMap,
  PerspectiveRuntimeState,
} from "@/components/sw/runtime";
import { TIMING_DRAFTS_STORAGE_KEY } from "@/components/sw/runtime";
import type { Perspective, WordTimingEntry } from "@/types/perspectives";

type PatchRuntime = (
  id: string,
  patch: Partial<PerspectiveRuntimeState>,
) => void;

type UseSwDraftStoreArgs = {
  topicId: string;
  perspectives: Perspective[];
  runtimeById: PerspectiveRuntimeMap;
  patchRuntime: PatchRuntime;
};

export const useSwDraftStore = ({
  topicId,
  perspectives,
  runtimeById,
  patchRuntime,
}: UseSwDraftStoreArgs) => {
  const localAudioBlobRef = useRef<Record<string, string>>({});
  const draftStoreLoadedRef = useRef(false);
  const draftStoreRef = useRef<
    Record<string, Record<string, WordTimingEntry[]>>
  >({});
  const draftWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureDraftStoreLoaded = useCallback(() => {
    if (draftStoreLoadedRef.current) return draftStoreRef.current;
    if (typeof window === "undefined") {
      draftStoreLoadedRef.current = true;
      return draftStoreRef.current;
    }
    const rawLocal = window.localStorage.getItem(TIMING_DRAFTS_STORAGE_KEY);
    const rawSession = window.sessionStorage.getItem(TIMING_DRAFTS_STORAGE_KEY);
    const raw = rawLocal ?? rawSession;
    if (!raw) {
      draftStoreLoadedRef.current = true;
      return draftStoreRef.current;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object") {
        draftStoreRef.current = parsed as Record<
          string,
          Record<string, WordTimingEntry[]>
        >;
      }
      // Migrate legacy session-scoped drafts to local persistence.
      if (!rawLocal && rawSession) {
        window.localStorage.setItem(TIMING_DRAFTS_STORAGE_KEY, rawSession);
        window.sessionStorage.removeItem(TIMING_DRAFTS_STORAGE_KEY);
      }
    } catch {
      // Ignore malformed temporary draft payloads.
    }
    draftStoreLoadedRef.current = true;
    return draftStoreRef.current;
  }, []);

  const flushDraftStore = useCallback(() => {
    if (typeof window === "undefined") return;
    const payload = JSON.stringify(draftStoreRef.current);
    try {
      window.localStorage.setItem(TIMING_DRAFTS_STORAGE_KEY, payload);
      window.sessionStorage.removeItem(TIMING_DRAFTS_STORAGE_KEY);
    } catch {
      // Fallback for restricted browsers (private mode/quota limits).
      try {
        window.sessionStorage.setItem(TIMING_DRAFTS_STORAGE_KEY, payload);
      } catch {
        // Ignore storage failures.
      }
    }
  }, []);

  const queueDraftFlush = useCallback(() => {
    if (draftWriteTimerRef.current !== null) return;
    draftWriteTimerRef.current = setTimeout(() => {
      draftWriteTimerRef.current = null;
      flushDraftStore();
    }, 120);
  }, [flushDraftStore]);

  const writeDraftTimings = useCallback(
    (perspectiveId: string, timings: WordTimingEntry[]) => {
      const store = ensureDraftStoreLoaded();
      const topicDrafts = store[topicId] ?? {};
      store[topicId] = {
        ...topicDrafts,
        [perspectiveId]: timings,
      };
      draftStoreRef.current = store;
      queueDraftFlush();
    },
    [ensureDraftStoreLoaded, queueDraftFlush, topicId],
  );

  const clearDraftTimings = useCallback(
    (perspectiveId: string) => {
      const store = ensureDraftStoreLoaded();
      const topicDrafts = store[topicId];
      if (!topicDrafts || !(perspectiveId in topicDrafts)) return;
      const nextTopicDrafts = { ...topicDrafts };
      delete nextTopicDrafts[perspectiveId];
      store[topicId] = nextTopicDrafts;
      draftStoreRef.current = store;
      queueDraftFlush();
    },
    [ensureDraftStoreLoaded, queueDraftFlush, topicId],
  );

  useEffect(() => {
    const previous = localAudioBlobRef.current;
    const nextBlobMap: Record<string, string> = {};
    for (const [id, runtime] of Object.entries(runtimeById)) {
      const url = runtime.localAudioOverride;
      if (url?.startsWith("blob:")) {
        nextBlobMap[id] = url;
      }
    }
    for (const [id, url] of Object.entries(previous)) {
      if (!url.startsWith("blob:")) continue;
      if (nextBlobMap[id] !== url) {
        URL.revokeObjectURL(url);
      }
    }
    localAudioBlobRef.current = nextBlobMap;
  }, [runtimeById]);

  useEffect(() => {
    return () => {
      const previous = localAudioBlobRef.current;
      for (const url of Object.values(previous)) {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (draftWriteTimerRef.current !== null) {
        clearTimeout(draftWriteTimerRef.current);
        draftWriteTimerRef.current = null;
        flushDraftStore();
      }
    };
  }, [flushDraftStore]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePageHide = () => {
      if (draftWriteTimerRef.current !== null) {
        clearTimeout(draftWriteTimerRef.current);
        draftWriteTimerRef.current = null;
      }
      flushDraftStore();
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [flushDraftStore]);

  useEffect(() => {
    const store = ensureDraftStoreLoaded();
    const topicDrafts = store[topicId];
    if (!topicDrafts || typeof topicDrafts !== "object") return;
    const perspectiveIds = new Set<string>(perspectives.map((item) => item.id));
    const entries = Object.entries(topicDrafts).filter(
      ([id, timings]) => perspectiveIds.has(id) && Array.isArray(timings),
    );
    if (!entries.length) return;
    for (const [id, timings] of entries) {
      if (runtimeById[id]?.timings !== undefined) continue;
      patchRuntime(id, {
        timings,
        timingsRevision: 1,
        lastDraftRevision: 1,
        dirtyTimings: true,
      });
    }
  }, [
    ensureDraftStoreLoaded,
    patchRuntime,
    perspectives,
    runtimeById,
    topicId,
  ]);

  return {
    writeDraftTimings,
    clearDraftTimings,
  };
};
