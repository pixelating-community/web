/// <reference lib="webworker" />

type DecodeAndProcessRequest = {
  type: "decodeAndProcess";
  arrayBuffer: ArrayBuffer;
  bars: number;
  trimEndMilliseconds?: number;
};

type ProcessDecodedRequest = {
  type: "processDecoded";
  sampleRate: number;
  channels: Float32Array[];
  bars: number;
  trimEndMilliseconds?: number;
};

type AudioWorkerRequest = DecodeAndProcessRequest | ProcessDecodedRequest;

type AudioWorkerSuccess = {
  ok: true;
  duration: number;
  waveform: number[];
  wavBuffer: ArrayBuffer;
};

type AudioWorkerFailure = {
  ok: false;
  error: string;
};

const encodeWavBuffer = (samples: Float32Array, sampleRate: number) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
    offset += 2;
  }

  return buffer;
};

const mixDownChannels = (channels: Float32Array[]) => {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels.length; channel += 1) {
    const data = channels[channel];
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i] ?? 0;
    }
  }
  const scale = 1 / channels.length;
  for (let i = 0; i < length; i += 1) {
    mono[i] *= scale;
  }
  return mono;
};

const buildWaveform = (samples: Float32Array, bars: number) => {
  if (bars <= 0) return [];
  const length = samples.length;
  if (length === 0) return Array.from({ length: bars }, () => 0);

  const step = Math.max(1, Math.floor(length / bars));
  const waveform = Array.from({ length: bars }, () => 0);
  for (let i = 0; i < bars; i += 1) {
    const start = i * step;
    const end = Math.min(start + step, length);
    let max = 0;
    for (let j = start; j < end; j += 1) {
      const value = Math.abs(samples[j] ?? 0);
      if (value > max) max = value;
    }
    waveform[i] = max;
  }

  const peak = Math.max(...waveform);
  if (peak > 0) {
    for (let i = 0; i < waveform.length; i += 1) {
      waveform[i] = waveform[i] / peak;
    }
  }

  return waveform;
};

const trimAudioTail = ({
  samples,
  sampleRate,
  trimMilliseconds,
  minRemainingMilliseconds = 200,
}: {
  samples: Float32Array;
  sampleRate: number;
  trimMilliseconds: number;
  minRemainingMilliseconds?: number;
}) => {
  if (!Number.isFinite(trimMilliseconds) || trimMilliseconds <= 0) {
    return samples;
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return samples;
  if (!samples.length) return samples;

  const trimSampleCount = Math.floor((trimMilliseconds / 1000) * sampleRate);
  if (trimSampleCount <= 0) return samples;

  const minRemainingSampleCount = Math.max(
    1,
    Math.floor((minRemainingMilliseconds / 1000) * sampleRate),
  );
  const nextLength = samples.length - trimSampleCount;
  if (nextLength < minRemainingSampleCount) {
    return samples;
  }
  return samples.subarray(0, nextLength);
};

const getAudioContextCtor = () => {
  const scoped = self as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return scoped.AudioContext ?? scoped.webkitAudioContext ?? null;
};

const decodeInWorker = async (arrayBuffer: ArrayBuffer) => {
  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    throw new Error("WORKER_DECODE_UNSUPPORTED");
  }
  const context = new AudioContextCtor();
  try {
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const channels = Array.from(
      { length: decoded.numberOfChannels },
      (_, i) => new Float32Array(decoded.getChannelData(i)),
    );
    return {
      channels,
      sampleRate: decoded.sampleRate,
      duration: decoded.duration,
    };
  } finally {
    await context.close().catch(() => {});
  }
};

const buildSuccess = ({
  channels,
  sampleRate,
  bars,
  trimEndMilliseconds = 0,
}: {
  channels: Float32Array[];
  sampleRate: number;
  bars: number;
  trimEndMilliseconds?: number;
}): AudioWorkerSuccess => {
  const mono = trimAudioTail({
    samples: mixDownChannels(channels),
    sampleRate,
    trimMilliseconds: trimEndMilliseconds,
  });
  const waveform = buildWaveform(mono, bars);
  const wavBuffer = encodeWavBuffer(mono, sampleRate);
  const resolvedDuration = sampleRate > 0 ? mono.length / sampleRate : 0;
  return {
    ok: true,
    duration: resolvedDuration,
    waveform,
    wavBuffer,
  };
};

self.onmessage = async (event: MessageEvent<AudioWorkerRequest>) => {
  const payload = event.data;
  try {
    if (payload.type === "decodeAndProcess") {
      const decoded = await decodeInWorker(payload.arrayBuffer);
      const response = buildSuccess({
        channels: decoded.channels,
        sampleRate: decoded.sampleRate,
        bars: payload.bars,
        trimEndMilliseconds: payload.trimEndMilliseconds,
      });
      self.postMessage(response, [response.wavBuffer]);
      return;
    }

    const response = buildSuccess({
      channels: payload.channels,
      sampleRate: payload.sampleRate,
      bars: payload.bars,
      trimEndMilliseconds: payload.trimEndMilliseconds,
    });
    self.postMessage(response, [response.wavBuffer]);
  } catch (error) {
    const response: AudioWorkerFailure = {
      ok: false,
      error: error instanceof Error ? error.message : "Audio worker failed",
    };
    self.postMessage(response);
  }
};
