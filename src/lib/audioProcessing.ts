import type { WordTimingEntry } from "@/types/perspectives";

export const MIN_WORD_SECONDS = 0.04;

export type BufferAnalysis = {
  peak: number;
  duration: number;
};

export type AudioAnalysis = {
  duration: number;
  waveform: number[];
};

type TimingSegment = {
  start: number;
  end: number;
};

export const encodeWav = (samples: Float32Array, sampleRate: number) => {
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
  return new Blob([buffer], { type: "audio/wav" });
};

export const getExtensionForMime = (mimeType: string) => {
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
};

export const mixDownToMono = (buffer: AudioBuffer) => {
  if (buffer.numberOfChannels === 1) {
    return new Float32Array(buffer.getChannelData(0));
  }
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      mono[i] += data[i];
    }
  }
  const scale = 1 / buffer.numberOfChannels;
  for (let i = 0; i < length; i += 1) {
    mono[i] *= scale;
  }
  return mono;
};

export const buildWaveform = (samples: Float32Array, bars: number) => {
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

export const trimAudioTail = ({
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
    // Preserve very short recordings instead of trimming to silence.
    return samples;
  }

  return samples.subarray(0, nextLength);
};

const normalizeSpeechSegments = (segments: TimingSegment[]) => {
  const cleaned = segments
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.end > segment.start,
    )
    .map((segment) => ({
      start: Math.max(0, segment.start),
      end: Math.max(0, segment.end),
    }))
    .sort((a, b) => a.start - b.start);

  if (cleaned.length <= 1) return cleaned;

  const merged: TimingSegment[] = [];
  for (const segment of cleaned) {
    const previous = merged[merged.length - 1];
    if (!previous) {
      merged.push(segment);
      continue;
    }
    if (segment.start <= previous.end) {
      previous.end = Math.max(previous.end, segment.end);
      continue;
    }
    merged.push(segment);
  }
  return merged;
};

export const createWordTimingsFromSegments = ({
  words,
  segments,
  duration,
}: {
  words: string[];
  segments: TimingSegment[];
  duration: number;
}) => {
  const wordCount = words.length;
  if (wordCount === 0) return [];

  const normalizedSegments = normalizeSpeechSegments(segments);
  const sourceSegments =
    normalizedSegments.length > 0
      ? normalizedSegments
      : duration > MIN_WORD_SECONDS
        ? [{ start: 0, end: duration }]
        : [];

  if (sourceSegments.length === 0) {
    return Array.from({ length: wordCount }, () => null as WordTimingEntry);
  }

  const segmentDurations = sourceSegments.map((segment) =>
    Math.max(segment.end - segment.start, MIN_WORD_SECONDS),
  );
  const totalDuration = segmentDurations.reduce((sum, value) => sum + value, 0);

  const rawCounts = segmentDurations.map(
    (segmentDuration) => (segmentDuration / totalDuration) * wordCount,
  );
  const counts = rawCounts.map((value) => Math.floor(value));
  let allocated = counts.reduce((sum, value) => sum + value, 0);

  if (allocated < wordCount) {
    const order = rawCounts
      .map((value, index) => ({
        index,
        fractional: value - Math.floor(value),
        duration: segmentDurations[index],
      }))
      .sort((a, b) => {
        if (b.fractional !== a.fractional) return b.fractional - a.fractional;
        return b.duration - a.duration;
      });
    let cursor = 0;
    while (allocated < wordCount) {
      const target = order[cursor % order.length];
      counts[target.index] += 1;
      allocated += 1;
      cursor += 1;
    }
  }

  if (allocated > wordCount) {
    const order = counts
      .map((value, index) => ({ index, value }))
      .sort((a, b) => b.value - a.value);
    let cursor = 0;
    while (allocated > wordCount && cursor < order.length * 4) {
      const target = order[cursor % order.length];
      if (counts[target.index] > 0) {
        counts[target.index] -= 1;
        allocated -= 1;
      }
      cursor += 1;
    }
  }

  const timings: WordTimingEntry[] = [];
  let wordIndex = 0;

  for (
    let segmentIndex = 0;
    segmentIndex < sourceSegments.length;
    segmentIndex += 1
  ) {
    const segment = sourceSegments[segmentIndex];
    const segmentWordCount = counts[segmentIndex] ?? 0;
    if (segmentWordCount <= 0) continue;

    const segmentDuration = Math.max(
      segment.end - segment.start,
      MIN_WORD_SECONDS * segmentWordCount,
    );
    const step = segmentDuration / segmentWordCount;

    for (
      let segmentWordIndex = 0;
      segmentWordIndex < segmentWordCount && wordIndex < wordCount;
      segmentWordIndex += 1
    ) {
      const start = segment.start + step * segmentWordIndex;
      const nextBoundary = segment.start + step * (segmentWordIndex + 1);
      const end = Math.max(
        start + MIN_WORD_SECONDS,
        Math.min(segment.end, nextBoundary),
      );
      timings.push({
        start,
        end,
        word: words[wordIndex],
      });
      wordIndex += 1;
    }
  }

  if (wordIndex < wordCount) {
    const fallbackStart = timings[timings.length - 1]?.end ?? 0;
    const safeDuration = Math.max(duration, fallbackStart + MIN_WORD_SECONDS);
    const remaining = wordCount - wordIndex;
    const step = Math.max(
      MIN_WORD_SECONDS,
      (safeDuration - fallbackStart) / Math.max(remaining, 1),
    );
    for (let i = 0; i < remaining; i += 1) {
      const start = fallbackStart + step * i;
      const end = start + step;
      timings.push({
        start,
        end,
        word: words[wordIndex],
      });
      wordIndex += 1;
    }
  }

  return timings.slice(0, wordCount);
};

export const decodeAudioBlob = async (blob: Blob) => {
  const AudioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextConstructor) {
    throw new Error("AudioContext not supported");
  }
  const context = new AudioContextConstructor();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close().catch(() => {});
  }
};

export const analyzeBuffer = (buffer: AudioBuffer): BufferAnalysis => {
  if (!buffer.length) return { peak: 0, duration: 0 };
  const channelCount = buffer.numberOfChannels;
  if (channelCount < 1) return { peak: 0, duration: 0 };
  const channels = Array.from({ length: channelCount }, (_, index) =>
    buffer.getChannelData(index),
  );
  const sampleCount = buffer.length;
  const step = Math.max(1, Math.floor(sampleCount / 5000));
  let peak = 0;
  for (let i = 0; i < sampleCount; i += step) {
    let value = 0;
    for (let c = 0; c < channelCount; c += 1) {
      value += Math.abs(channels[c][i] ?? 0);
    }
    const normalized = value / channelCount;
    if (normalized > peak) peak = normalized;
  }
  return { peak, duration: buffer.duration };
};
