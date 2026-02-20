import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildR2Key,
  createR2DownloadUrl,
  getR2PublicUrl,
  putR2Object,
} from "../src/lib/r2";

type InputLayout = "mono" | "dual_mono" | "stereo" | "unknown";

type ParsedArgs = {
  inputKey: string;
  inputKey2?: string;
  outputKey?: string;
  outputFormat: "m4a" | "wav";
  denoiseMix: number;
  modelPath: string;
};

type ProbeInfo = {
  channels: number;
  sampleRate: number | null;
  durationSeconds: number | null;
};

type CmdResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

const usage = `Usage:
  bun run audio:worker --input-key <r2-key> [--input-key-2 <r2-key>] [--output-key <r2-key>] [--format m4a|wav] [--mix 0.8] [--model cb.rnnn]

Examples:
  bun run audio:worker --input-key recordings/in.wav --mix 0.8 --model cb.rnnn
  bun run audio:worker --input-key host.wav --input-key-2 guest.wav --format m4a --output-key cleaned/podcast-short.m4a
`;

const parseArgs = (): ParsedArgs => {
  const args = Bun.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    process.exit(0);
  }

  const parsed: ParsedArgs = {
    inputKey: "",
    outputFormat: "m4a",
    denoiseMix: 0.8,
    modelPath: process.env.ARNNDN_MODEL_PATH?.trim() || "cb.rnnn",
  };

  const nextValue = (index: number, flag: string) => {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--input-key": {
        parsed.inputKey = nextValue(i, arg);
        i += 1;
        break;
      }
      case "--input-key-2": {
        parsed.inputKey2 = nextValue(i, arg);
        i += 1;
        break;
      }
      case "--output-key": {
        parsed.outputKey = nextValue(i, arg);
        i += 1;
        break;
      }
      case "--format": {
        const value = nextValue(i, arg).toLowerCase();
        if (value !== "m4a" && value !== "wav") {
          throw new Error("--format must be m4a or wav");
        }
        parsed.outputFormat = value;
        i += 1;
        break;
      }
      case "--mix": {
        const value = Number(nextValue(i, arg));
        if (!Number.isFinite(value)) {
          throw new Error("--mix must be a number between 0 and 1");
        }
        parsed.denoiseMix = Math.max(0, Math.min(1, value));
        i += 1;
        break;
      }
      case "--model": {
        parsed.modelPath = nextValue(i, arg);
        i += 1;
        break;
      }
      default: {
        if (arg.startsWith("--")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
      }
    }
  }

  if (!parsed.inputKey.trim()) {
    throw new Error("--input-key is required");
  }

  parsed.inputKey = parsed.inputKey.trim();
  parsed.inputKey2 = parsed.inputKey2?.trim() || undefined;
  parsed.outputKey = parsed.outputKey?.trim() || undefined;
  parsed.modelPath = parsed.modelPath.trim();

  return parsed;
};

const resolveModelPath = (value: string) => {
  if (path.isAbsolute(value)) return value;
  return path.join("/models", value);
};

const escapeForFilterArg = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll(",", "\\,")
    .replaceAll("'", "\\'");

const runCmd = async (cmd: string[]): Promise<CmdResult> => {
  const proc = Bun.spawn(cmd, {
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

const downloadR2KeyToFile = async ({
  key,
  filePath,
}: {
  key: string;
  filePath: string;
}) => {
  const url = await createR2DownloadUrl({ key });
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download "${key}" from R2 (${res.status})`);
  }
  await Bun.write(filePath, res);
};

const probeInput = async (inputPath: string): Promise<ProbeInfo> => {
  const result = await runCmd([
    "ffprobe",
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=channels,sample_rate,duration",
    "-of",
    "json",
    inputPath,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(`ffprobe failed for "${inputPath}": ${result.stderr}`);
  }

  type ProbePayload = {
    streams?: Array<{
      channels?: number;
      sample_rate?: string;
      duration?: string;
    }>;
  };
  const payload = JSON.parse(result.stdout) as ProbePayload;
  const stream = payload.streams?.[0];
  if (!stream || typeof stream.channels !== "number" || stream.channels < 1) {
    throw new Error(`No readable audio stream found in "${inputPath}"`);
  }

  const sampleRate = stream.sample_rate ? Number(stream.sample_rate) : null;
  const duration = stream.duration ? Number(stream.duration) : null;

  return {
    channels: stream.channels,
    sampleRate:
      typeof sampleRate === "number" && Number.isFinite(sampleRate) && sampleRate > 0
        ? sampleRate
        : null,
    durationSeconds:
      typeof duration === "number" && Number.isFinite(duration) && duration > 0
        ? duration
        : null,
  };
};

const detectStereoLayout = async (inputPath: string): Promise<InputLayout> => {
  const probe = await probeInput(inputPath);
  if (probe.channels === 1) return "mono";
  if (probe.channels !== 2) return "unknown";

  const result = await runCmd([
    "ffmpeg",
    "-hide_banner",
    "-i",
    inputPath,
    "-filter_complex",
    "[0:a]pan=mono|c0=c0-c1,astats=metadata=1:reset=1",
    "-f",
    "null",
    "-",
  ]);

  if (result.exitCode !== 0) {
    return "unknown";
  }

  const matches = [...result.stderr.matchAll(/RMS level dB:\s*(-?inf|[-\d.]+)/gi)];
  const raw = matches.at(-1)?.[1]?.toLowerCase();
  if (!raw) return "unknown";
  if (raw.includes("inf")) return "dual_mono";

  const rmsDiff = Number(raw);
  if (!Number.isFinite(rmsDiff)) return "unknown";
  return rmsDiff <= -35 ? "dual_mono" : "stereo";
};

const ensureModelExists = async (modelPath: string) => {
  if (!(await Bun.file(modelPath).exists())) {
    throw new Error(
      `ARNNDN model not found at "${modelPath}". Mount the model file into the container.`,
    );
  }
};

const buildSingleTrackFilter = ({
  modelPath,
  denoiseMix,
}: {
  modelPath: string;
  denoiseMix: number;
}) =>
  [
    "aformat=channel_layouts=mono",
    "highpass=f=80",
    "lowpass=f=8000",
    `arnndn=m=${escapeForFilterArg(modelPath)}:mix=${denoiseMix.toFixed(3)}`,
    "agate=threshold=0.02:ratio=2:attack=20:release=200",
    "alimiter=limit=0.95",
    "loudnorm=I=-16:TP=-1.5:LRA=7",
  ].join(",");

const buildDualTrackFilter = ({
  modelPath,
  denoiseMix,
}: {
  modelPath: string;
  denoiseMix: number;
}) => {
  const chain = [
    "aformat=channel_layouts=mono",
    "highpass=f=80",
    "lowpass=f=8000",
    `arnndn=m=${escapeForFilterArg(modelPath)}:mix=${denoiseMix.toFixed(3)}`,
    "agate=threshold=0.02:ratio=2:attack=20:release=200",
    "alimiter=limit=0.95",
  ].join(",");

  return [
    `[0:a]${chain}[a0]`,
    `[1:a]${chain}[a1]`,
    "[a0][a1]amix=inputs=2:normalize=0:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=7[out]",
  ].join(";");
};

const getContentTypeForOutput = (format: "m4a" | "wav") =>
  format === "wav" ? "audio/wav" : "audio/mp4";

const run = async () => {
  const args = parseArgs();
  const modelPath = resolveModelPath(args.modelPath);
  await ensureModelExists(modelPath);

  const tmpRoot = await mkdtemp(path.join(tmpdir(), "audio-worker-"));
  const inputPathA = path.join(tmpRoot, "input-a");
  const inputPathB = path.join(tmpRoot, "input-b");
  const outputPath = path.join(tmpRoot, `output.${args.outputFormat}`);

  try {
    await downloadR2KeyToFile({ key: args.inputKey, filePath: inputPathA });
    if (args.inputKey2) {
      await downloadR2KeyToFile({ key: args.inputKey2, filePath: inputPathB });
    }

    const probeA = await probeInput(inputPathA);
    const layoutA = await detectStereoLayout(inputPathA);
    const twoTracksDetected = Boolean(args.inputKey2) || probeA.channels >= 2;

    let layoutB: InputLayout | null = null;
    let probeB: ProbeInfo | null = null;
    if (args.inputKey2) {
      probeB = await probeInput(inputPathB);
      layoutB = await detectStereoLayout(inputPathB);
    }

    const ffmpegArgs = args.inputKey2
      ? [
          "ffmpeg",
          "-y",
          "-hide_banner",
          "-i",
          inputPathA,
          "-i",
          inputPathB,
          "-filter_complex",
          buildDualTrackFilter({
            modelPath,
            denoiseMix: args.denoiseMix,
          }),
          "-map",
          "[out]",
          "-ac",
          "1",
          ...(args.outputFormat === "wav"
            ? ["-c:a", "pcm_s16le"]
            : ["-c:a", "aac", "-b:a", "192k"]),
          outputPath,
        ]
      : [
          "ffmpeg",
          "-y",
          "-hide_banner",
          "-i",
          inputPathA,
          "-af",
          buildSingleTrackFilter({
            modelPath,
            denoiseMix: args.denoiseMix,
          }),
          "-ac",
          "1",
          ...(args.outputFormat === "wav"
            ? ["-c:a", "pcm_s16le"]
            : ["-c:a", "aac", "-b:a", "192k"]),
          outputPath,
        ];

    const ffmpegResult = await runCmd(ffmpegArgs);
    if (ffmpegResult.exitCode !== 0) {
      throw new Error(`ffmpeg failed:\n${ffmpegResult.stderr}`);
    }

    const outputKey =
      args.outputKey ||
      buildR2Key(`cleaned-${Date.now().toString()}.${args.outputFormat}`);
    const outputBytes = Buffer.from(await Bun.file(outputPath).arrayBuffer());
    await putR2Object({
      key: outputKey,
      body: outputBytes,
      contentType: getContentTypeForOutput(args.outputFormat),
    });

    const summary = {
      ok: true,
      input: {
        key: args.inputKey,
        channels: probeA.channels,
        sampleRate: probeA.sampleRate,
        durationSeconds: probeA.durationSeconds,
        layout: layoutA,
      },
      input2: probeB
        ? {
            key: args.inputKey2,
            channels: probeB.channels,
            sampleRate: probeB.sampleRate,
            durationSeconds: probeB.durationSeconds,
            layout: layoutB,
          }
        : null,
      detectedTwoTracks: twoTracksDetected,
      output: {
        key: outputKey,
        publicUrl: getR2PublicUrl(outputKey),
        format: args.outputFormat,
      },
      processing: {
        modelPath,
        denoiseMix: args.denoiseMix,
      },
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};

await run();
