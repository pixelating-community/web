import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CANONICAL_AUDIO_CONTENT_TYPE,
  transcodeAudioFileToM4a,
} from "@/lib/audioTranscode";

type BunStub = {
  file: ReturnType<typeof vi.fn>;
  spawn: ReturnType<typeof vi.fn>;
  write: ReturnType<typeof vi.fn>;
};

const createReadableStream = (value = "") =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      if (value) {
        controller.enqueue(new TextEncoder().encode(value));
      }
      controller.close();
    },
  });

type BunRuntime = {
  file: BunStub["file"];
  spawn: BunStub["spawn"];
  write: BunStub["write"];
};

describe("transcodeAudioFileToM4a", () => {
  const bunRuntime = (globalThis as { Bun: BunRuntime }).Bun;
  let bunStub: BunStub;
  const originalFile = bunRuntime.file;
  const originalSpawn = bunRuntime.spawn;
  const originalWrite = bunRuntime.write;

  beforeEach(() => {
    bunStub = {
      file: vi.fn(() => ({
        arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
      })),
      spawn: vi.fn(() => ({
        exited: Promise.resolve(0),
        stderr: createReadableStream(),
        stdout: createReadableStream(),
      })),
      write: vi.fn().mockResolvedValue(undefined),
    };

    bunRuntime.file = bunStub.file;
    bunRuntime.spawn = bunStub.spawn;
    bunRuntime.write = bunStub.write;
  });

  afterEach(() => {
    bunRuntime.file = originalFile;
    bunRuntime.spawn = originalSpawn;
    bunRuntime.write = originalWrite;
  });

  it("normalizes parameterized mime types when deriving the input extension", async () => {
    const file = new File([new Uint8Array([7, 8, 9])], "recording", {
      type: "audio/webm;codecs=opus",
    });

    const result = await transcodeAudioFileToM4a({
      file,
      filename: "recording",
      contentType: "audio/webm;codecs=opus",
    });

    expect(bunStub.write).toHaveBeenCalledTimes(1);
    expect(String(bunStub.write.mock.calls[0]?.[0])).toMatch(/input\.webm$/);

    expect(bunStub.spawn).toHaveBeenCalledTimes(1);
    expect(bunStub.spawn.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        "ffmpeg",
        expect.stringMatching(/input\.webm$/),
        expect.stringMatching(/recording\.m4a$/),
      ]),
    );

    expect(result).toEqual({
      body: Buffer.from([1, 2, 3]),
      contentType: CANONICAL_AUDIO_CONTENT_TYPE,
      filename: "recording.m4a",
    });
  });

  it("adds an ffmpeg pitch-preserving filter chain when pitch shifting is requested", async () => {
    const file = new File([new Uint8Array([7, 8, 9])], "remix.wav", {
      type: "audio/wav",
    });

    await transcodeAudioFileToM4a({
      file,
      filename: "remix.wav",
      contentType: "audio/wav",
      pitchSemitones: 7,
    });

    expect(bunStub.spawn).toHaveBeenCalledTimes(1);
    expect(bunStub.spawn.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        "-af",
        expect.stringContaining("aresample=48000,asetrate=48000*"),
      ]),
    );
    expect(bunStub.spawn.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([expect.stringContaining(",atempo=")]),
    );
  });
});
