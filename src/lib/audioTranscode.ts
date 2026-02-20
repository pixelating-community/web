import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const CANONICAL_AUDIO_EXTENSION = ".m4a";
export const CANONICAL_AUDIO_CONTENT_TYPE = "audio/mp4";
const CANONICAL_AUDIO_BITRATE_KBPS = 192;
const CANONICAL_AUDIO_SAMPLE_RATE = 48_000;
const CANONICAL_AUDIO_CHANNELS = 1;
const MAX_PITCH_SEMITONES = 12;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "audio/aac": ".aac",
  "audio/aacp": ".aac",
  "audio/flac": ".flac",
  "audio/mp4": ".m4a",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/x-flac": ".flac",
  "audio/x-m4a": ".m4a",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
};

type BunSpawnProcLike = {
  exited: Promise<number>;
  stderr: ReadableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
};

type BunRuntimeLike = {
  file: (path: string) => {
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
  spawn: (
    cmd: string[],
    options: {
      stderr: "pipe";
      stdout: "pipe";
    },
  ) => BunSpawnProcLike;
  write: (
    path: string,
    data: Buffer | Uint8Array | ArrayBuffer,
  ) => Promise<unknown>;
};

const safeExtension = (value: string) => {
  const ext = path.extname(value).toLowerCase();
  return ext.length > 0 && ext.length <= 8 ? ext : "";
};

const normalizeContentType = (value: string) =>
  value.split(";")[0]?.trim().toLowerCase() ?? "";

const resolveInputExtension = ({
  filename,
  contentType,
}: {
  filename: string;
  contentType: string;
}) =>
  safeExtension(filename) ||
  MIME_EXTENSION_MAP[normalizeContentType(contentType)] ||
  "";

const buildCanonicalAudioFilename = (filename: string) => {
  const basename = path.basename(filename, path.extname(filename)).trim();
  const safeBase = basename.length > 0 ? basename : "recording";
  return `${safeBase}${CANONICAL_AUDIO_EXTENSION}`;
};

const getBunRuntime = () => {
  const bunRuntime = (globalThis as { Bun?: BunRuntimeLike }).Bun;
  if (!bunRuntime) {
    throw new Error("Bun runtime is required for audio transcoding.");
  }
  return bunRuntime;
};

const runCmd = async (cmd: string[]) => {
  const bunRuntime = getBunRuntime();
  const proc = bunRuntime.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdoutBytes, stderrBytes, exitCode] = await Promise.all([
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).arrayBuffer(),
    proc.exited,
  ]);
  return {
    exitCode,
    stdout: Buffer.from(stdoutBytes).toString("utf8"),
    stderr: Buffer.from(stderrBytes).toString("utf8"),
  };
};

export const transcodeAudioFileToM4a = async ({
  file,
  filename,
  contentType,
  pitchSemitones = 0,
}: {
  file: File;
  filename: string;
  contentType: string;
  pitchSemitones?: number;
}) => {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "audio-upload-"));
  const inputPath = path.join(
    tmpRoot,
    `input${resolveInputExtension({ filename, contentType })}`,
  );
  const outputPath = path.join(tmpRoot, buildCanonicalAudioFilename(filename));

  try {
    const bunRuntime = getBunRuntime();
    await bunRuntime.write(inputPath, Buffer.from(await file.arrayBuffer()));
    const clampedPitchSemitones = Math.max(
      -MAX_PITCH_SEMITONES,
      Math.min(MAX_PITCH_SEMITONES, Math.round(pitchSemitones)),
    );
    const pitchFactor = 2 ** (clampedPitchSemitones / 12);
    const pitchFilter =
      clampedPitchSemitones === 0
        ? []
        : [
            "-af",
            `aresample=${CANONICAL_AUDIO_SAMPLE_RATE},asetrate=${CANONICAL_AUDIO_SAMPLE_RATE}*${pitchFactor.toFixed(
              8,
            )},aresample=${CANONICAL_AUDIO_SAMPLE_RATE},atempo=${(1 / pitchFactor).toFixed(
              8,
            )}`,
          ];
    const result = await runCmd([
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-vn",
      ...pitchFilter,
      "-movflags",
      "+faststart",
      "-ar",
      `${CANONICAL_AUDIO_SAMPLE_RATE}`,
      "-ac",
      `${CANONICAL_AUDIO_CHANNELS}`,
      "-c:a",
      "aac",
      "-b:a",
      `${CANONICAL_AUDIO_BITRATE_KBPS}k`,
      outputPath,
    ]);

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || "ffmpeg transcode failed");
    }

    const outputFile = bunRuntime.file(outputPath);
    const outputBytes = Buffer.from(await outputFile.arrayBuffer());
    return {
      body: outputBytes,
      filename: buildCanonicalAudioFilename(filename),
      contentType: CANONICAL_AUDIO_CONTENT_TYPE,
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};
