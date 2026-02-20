import { describe, expect, it } from "vitest";
import {
  analyzeBuffer,
  createWordTimingsFromSegments,
  encodeDualMonoWav,
  getExtensionForMime,
  hasSevereStereoImbalance,
  trimAudioTail,
} from "@/lib/audioProcessing";

describe("audio processing", () => {
  it("computes peak and duration without silence detection segments", () => {
    const channelData = Float32Array.from([0, 0.25, -0.5, 0.1]);
    const buffer = {
      duration: 2,
      getChannelData: () => channelData,
      length: channelData.length,
      numberOfChannels: 1,
      sampleRate: 2,
    } as unknown as AudioBuffer;

    const analysis = analyzeBuffer(buffer);
    expect(analysis.peak).toBeCloseTo(0.5, 4);
    expect(analysis.duration).toBe(2);
  });

  it("falls back to evenly distributed timings when no segments are provided", () => {
    const timings = createWordTimingsFromSegments({
      words: ["one", "two", "three"],
      segments: [],
      duration: 0.6,
    });

    expect(timings).toHaveLength(3);
    expect(timings[0]?.start).toBeCloseTo(0, 4);
    expect(timings[1]?.start).toBeCloseTo(0.2, 4);
    expect(timings[2]?.start).toBeCloseTo(0.4, 4);
  });

  it("trims the configured tail duration when recording is long enough", () => {
    const samples = new Float32Array(1000).fill(0.1);
    const trimmed = trimAudioTail({
      samples,
      sampleRate: 1000,
      trimMilliseconds: 500,
    });
    expect(trimmed.length).toBe(500);
  });

  it("keeps very short recordings intact when trimming would remove too much", () => {
    const samples = new Float32Array(300).fill(0.1);
    const trimmed = trimAudioTail({
      samples,
      sampleRate: 1000,
      trimMilliseconds: 500,
    });
    expect(trimmed.length).toBe(samples.length);
  });

  it("falls back to webm for unsupported audio mime types", () => {
    expect(getExtensionForMime("audio/mpeg")).toBe("webm");
  });

  it("maps audio/webm;codecs=opus to webm extension", () => {
    expect(getExtensionForMime("audio/webm;codecs=opus")).toBe("webm");
  });

  it("detects severe stereo channel imbalance", () => {
    const left = Float32Array.from([0.2, -0.3, 0.25, -0.2]);
    const right = Float32Array.from([0.001, -0.001, 0.001, -0.001]);
    const buffer = {
      duration: 1,
      length: left.length,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: (index: number) => (index === 0 ? left : right),
    } as unknown as AudioBuffer;

    expect(hasSevereStereoImbalance(buffer)).toBe(true);
  });

  it("does not flag balanced stereo as imbalanced", () => {
    const left = Float32Array.from([0.2, -0.3, 0.25, -0.2]);
    const right = Float32Array.from([0.18, -0.28, 0.22, -0.19]);
    const buffer = {
      duration: 1,
      length: left.length,
      numberOfChannels: 2,
      sampleRate: 48_000,
      getChannelData: (index: number) => (index === 0 ? left : right),
    } as unknown as AudioBuffer;

    expect(hasSevereStereoImbalance(buffer)).toBe(false);
  });

  it("encodes dual-mono wav with two channels", async () => {
    const mono = Float32Array.from([0.5, -0.5]);
    const wav = encodeDualMonoWav(mono, 48_000);
    const bytes = await wav.arrayBuffer();
    const view = new DataView(bytes);

    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getInt16(44, true)).toBe(view.getInt16(46, true));
    expect(view.getInt16(48, true)).toBe(view.getInt16(50, true));
  });
});
