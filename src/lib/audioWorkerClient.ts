"use client";

type WorkerDecodeRequest = {
  type: "decodeAndProcess";
  arrayBuffer: ArrayBuffer;
  bars: number;
  trimEndMilliseconds?: number;
};

type WorkerProcessDecodedRequest = {
  type: "processDecoded";
  sampleRate: number;
  channels: Float32Array[];
  bars: number;
  trimEndMilliseconds?: number;
};

type WorkerRequest = WorkerDecodeRequest | WorkerProcessDecodedRequest;

type WorkerSuccess = {
  ok: true;
  duration: number;
  waveform: number[];
  wavBuffer: ArrayBuffer;
};

type WorkerFailure = {
  ok: false;
  error: string;
};

type WorkerResponse = WorkerSuccess | WorkerFailure;

export type WorkerAudioResult = {
  duration: number;
  waveform: number[];
  wavBlob: Blob;
};

const createAudioWorker = () => {
  if (typeof Worker === "undefined") return null;
  return new Worker(
    new URL("../workers/audio-processing.worker.ts", import.meta.url),
    {
      type: "module",
    },
  );
};

const runAudioWorkerJob = (
  request: WorkerRequest,
  transfers: Transferable[] = [],
) =>
  new Promise<WorkerSuccess>((resolve, reject) => {
    const worker = createAudioWorker();
    if (!worker) {
      reject(new Error("Web Worker not supported"));
      return;
    }

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.ok === false) {
        cleanup();
        reject(new Error(response.error));
        return;
      }
      cleanup();
      resolve(response);
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error("Audio worker crashed"));
    };

    worker.postMessage(request, transfers);
  });

const toAudioResult = (result: WorkerSuccess): WorkerAudioResult => ({
  duration: result.duration,
  waveform: result.waveform,
  wavBlob: new Blob([result.wavBuffer], { type: "audio/wav" }),
});

export const decodeAndProcessWithWorker = async ({
  blob,
  bars,
  trimEndMilliseconds = 0,
}: {
  blob: Blob;
  bars: number;
  trimEndMilliseconds?: number;
}) => {
  const arrayBuffer = await blob.arrayBuffer();
  const result = await runAudioWorkerJob(
    {
      type: "decodeAndProcess",
      arrayBuffer,
      bars,
      trimEndMilliseconds,
    },
    [arrayBuffer],
  );
  return toAudioResult(result);
};

export const processDecodedWithWorker = async ({
  sampleRate,
  channels,
  bars,
  trimEndMilliseconds = 0,
}: {
  sampleRate: number;
  channels: Float32Array[];
  bars: number;
  trimEndMilliseconds?: number;
}) => {
  const transfers = channels
    .map((channel) => channel.buffer)
    .filter((buffer): buffer is ArrayBuffer => buffer instanceof ArrayBuffer);
  const result = await runAudioWorkerJob(
    {
      type: "processDecoded",
      sampleRate,
      channels,
      bars,
      trimEndMilliseconds,
    },
    transfers,
  );
  return toAudioResult(result);
};
