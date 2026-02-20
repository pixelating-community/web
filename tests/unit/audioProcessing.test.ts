import { describe, expect, it } from "vitest";
import {
  analyzeBuffer,
  createWordTimingsFromSegments,
  getExtensionForMime,
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

  it("maps audio/mpeg to mp3 extension", () => {
    expect(getExtensionForMime("audio/mpeg")).toBe("mp3");
  });

  it("maps audio/webm;codecs=opus to webm extension", () => {
    expect(getExtensionForMime("audio/webm;codecs=opus")).toBe("webm");
  });
});
