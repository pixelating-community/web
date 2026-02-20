import type { WordTimingEntry } from "@/types/perspectives";

export type PendingRecordingPlaybackMode = "single" | "sequence";

export type PendingRecording = {
  id: string;
  blob: Blob;
  mimeType?: string;
  perspectiveId: string;
  words: string[];
  timings: WordTimingEntry[];
  duration?: number;
  returnPath: string;
  playbackMode: PendingRecordingPlaybackMode;
  createdAt: number;
};

const pendingRecordings = new Map<string, PendingRecording>();
const DB_NAME = "pixelating-sw-recordings";
const DB_VERSION = 1;
const STORE_NAME = "pending-recordings";
let openDbPromise: Promise<IDBDatabase | null> | null = null;

const createPendingId = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const hasIndexedDb = () =>
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

const openDb = () => {
  if (!hasIndexedDb()) {
    return Promise.resolve(null);
  }
  if (openDbPromise) {
    return openDbPromise;
  }
  openDbPromise = new Promise((resolve) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("Pending recording DB unavailable", request.error);
      resolve(null);
    };
    request.onblocked = () => resolve(null);
  });
  return openDbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T>,
) => {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(STORE_NAME, mode);
  const store = tx.objectStore(STORE_NAME);
  return run(store);
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const persistPendingRecording = async (recording: PendingRecording) => {
  try {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.put(recording));
      return true;
    });
  } catch (error) {
    console.warn("Failed to persist pending recording", {
      id: recording.id,
      error,
    });
  }
};

const loadPendingRecording = async (id: string) => {
  try {
    return await withStore("readonly", async (store) => {
      const entry = await requestToPromise<PendingRecording | undefined>(
        store.get(id),
      );
      return entry ?? null;
    });
  } catch (error) {
    console.warn("Failed to load pending recording", { id, error });
    return null;
  }
};

const removePendingRecording = async (id: string) => {
  try {
    await withStore("readwrite", async (store) => {
      await requestToPromise(store.delete(id));
      return true;
    });
  } catch (error) {
    console.warn("Failed to clear pending recording", { id, error });
  }
};

export const setPendingRecording = (
  recording: Omit<PendingRecording, "id" | "createdAt">,
) => {
  const id = createPendingId();
  const entry: PendingRecording = {
    ...recording,
    id,
    createdAt: Date.now(),
  };
  pendingRecordings.set(id, entry);
  void persistPendingRecording(entry);
  return id;
};

export const getPendingRecording = (id: string) => {
  const key = id.trim();
  if (!key) return null;
  return pendingRecordings.get(key) ?? null;
};

export const getPendingRecordingAsync = async (id: string) => {
  const key = id.trim();
  if (!key) return null;

  const inMemory = pendingRecordings.get(key);
  if (inMemory) return inMemory;

  const persisted = await loadPendingRecording(key);
  if (persisted) {
    pendingRecordings.set(key, persisted);
    return persisted;
  }
  return null;
};

export const clearPendingRecording = (id: string) => {
  const key = id.trim();
  if (!key) return;
  pendingRecordings.delete(key);
  void removePendingRecording(key);
};

export const clearPendingRecordingAsync = async (id: string) => {
  const key = id.trim();
  if (!key) return;
  pendingRecordings.delete(key);
  await removePendingRecording(key);
};
