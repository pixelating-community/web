import "@tanstack/react-start/server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { z } from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import {
  AUDIO_IMPORT_MAX_FILE_SIZE_BYTES,
  AUDIO_IMPORT_MAX_FILE_SIZE_LABEL,
  type AudioImportStep,
  audioImportSchema,
} from "@/lib/audioImport";
import { sql } from "@/lib/db.server";
import { buildR2Key, putR2Object } from "@/lib/r2.server";

export { audioImportSchema } from "@/lib/audioImport";

const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_CHANNELS = 2;
const AUDIO_BITRATE_KBPS = 256;
const AUDIO_PROBE_TIMEOUT_MS = 60_000;
const AUDIO_CONVERT_TIMEOUT_MS = 8 * 60 * 1000;

const getPrimaryProbeValue = (stdout: string) =>
  stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";

const guessUploadContentType = (file: File) => {
  if (file.type.trim()) return file.type.trim();
  const ext = path.extname(file.name || "").toLowerCase();
  const map: Record<string, string> = {
    ".m4v": "video/mp4",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
  };
  return map[ext] ?? "application/octet-stream";
};

const isDirectM4aUpload = ({
  audioCodec,
  hasVideoStream,
  sourceExt,
}: {
  audioCodec: string;
  hasVideoStream: boolean;
  sourceExt: string;
}) => sourceExt === ".m4a" && audioCodec === "aac" && !hasVideoStream;

type BunSpawnProcLike = {
  exited: Promise<number>;
  kill?: () => void;
  stderr: ReadableStream<Uint8Array>;
  stdout: ReadableStream<Uint8Array>;
};

type BunRuntimeLike = {
  file: (path: string) => {
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
  spawn: (
    cmd: string[],
    options: { stderr: "pipe"; stdout: "pipe" },
  ) => BunSpawnProcLike;
};

const getBunRuntime = () => {
  const bunRuntime = (globalThis as { Bun?: BunRuntimeLike }).Bun;
  if (!bunRuntime) {
    throw new Error("Bun runtime is required for audio import.");
  }
  return bunRuntime;
};

const runCmd = async (
  cmd: string[],
  timeoutMs: number,
  timeoutLabel: string,
) => {
  const bunRuntime = getBunRuntime();
  const proc = bunRuntime.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      proc.kill?.();
      reject(new Error(`${timeoutLabel} timed out`));
    }, timeoutMs);
  });
  const [stdoutBytes, stderrBytes, exitCode] = await Promise.race([
    Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
      proc.exited,
    ]),
    timeout,
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
  return {
    exitCode,
    stdout: Buffer.from(stdoutBytes).toString("utf8"),
    stderr: Buffer.from(stderrBytes).toString("utf8"),
  };
};

type ProgressCallback = (step: AudioImportStep) => void;

const verifyPerspective = async (data: {
  actionToken: string;
  topicId: string;
  perspectiveId: string;
}) => {
  const verified = verifyActionToken({
    token: data.actionToken,
    requiredScope: "perspective:align",
    topicId: data.topicId,
  });
  if (!verified) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  const rows = await sql<{ id: string; topic_id: string }>`
    SELECT id, topic_id FROM perspectives
    WHERE id = ${data.perspectiveId}
    LIMIT 1;
  `;
  if (rows.length === 0) {
    return { ok: false as const, error: "Perspective not found", status: 404 };
  }
  if (rows[0].topic_id !== data.topicId) {
    return { ok: false as const, error: "Unauthorized", status: 401 };
  }

  return { ok: true as const };
};

export const importAudioFile = async ({
  data,
  file,
  onProgress,
}: {
  data: z.infer<typeof audioImportSchema>;
  file?: File;
  onProgress?: ProgressCallback;
}) => {
  const check = await verifyPerspective(data);
  if (!check.ok) return check;

  // R2 key path — assign the key directly
  if (data.r2Key) {
    onProgress?.("uploading");
    await sql`
      UPDATE perspectives
      SET audio_src = ${data.r2Key}, video_src = NULL, updated_at = NOW()
      WHERE id = ${data.perspectiveId};
    `;
    onProgress?.("done");
    return { ok: true as const, r2Key: data.r2Key };
  }

  if (!file) {
    return { ok: false as const, error: "No file or R2 key provided", status: 400 };
  }

  if (file.size > AUDIO_IMPORT_MAX_FILE_SIZE_BYTES) {
    return {
      ok: false as const,
      error: `File too large (${AUDIO_IMPORT_MAX_FILE_SIZE_LABEL} max)`,
      status: 400,
    };
  }

  const tmpRoot = await mkdtemp(path.join(tmpdir(), "audio-import-"));
  try {
    onProgress?.("preparing");

    const ext = path.extname(file.name || "").toLowerCase() || ".bin";
    const sourcePath = path.join(tmpRoot, `source${ext}`);
    const fileBytes = Buffer.from(await file.arrayBuffer());
    await writeFile(sourcePath, fileBytes);

    onProgress?.("classifying");

    const probeResult = await runCmd([
      "ffprobe",
      "-v", "error",
      "-select_streams", "a:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      sourcePath,
    ], AUDIO_PROBE_TIMEOUT_MS, "Audio probe");

    if (probeResult.exitCode !== 0) {
      return {
        ok: false as const,
        error: "Not a valid audio or video file",
        status: 400,
      };
    }
    const audioCodec = getPrimaryProbeValue(probeResult.stdout);
    if (!audioCodec) {
      return {
        ok: false as const,
        error: "No audio stream found in this file",
        status: 400,
      };
    }

    const videoProbeResult = await runCmd([
      "ffprobe",
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name",
      "-of", "csv=p=0",
      sourcePath,
    ], AUDIO_PROBE_TIMEOUT_MS, "Video probe");
    const hasVideoStream =
      videoProbeResult.exitCode === 0 &&
      getPrimaryProbeValue(videoProbeResult.stdout).length > 0;

    const videoR2Key = hasVideoStream
      ? buildR2Key(file.name || "video")
      : null;
    let videoUploadError: unknown;
    const videoUploadPromise = videoR2Key
      ? putR2Object({
          key: videoR2Key,
          contentType: guessUploadContentType(file),
          body: fileBytes,
        }).catch((error) => {
          console.error("[audio-import] video upload failed", {
            perspectiveId: data.perspectiveId,
            videoR2Key,
            error: error instanceof Error ? error.message : String(error),
          });
          videoUploadError = error;
        })
      : null;

    if (
      isDirectM4aUpload({
        audioCodec,
        hasVideoStream,
        sourceExt: ext,
      })
    ) {
      onProgress?.("uploading");
      const r2Key = buildR2Key(file.name || "music.m4a");
      await putR2Object({
        key: r2Key,
        contentType: "audio/mp4",
        body: fileBytes,
      });
      onProgress?.("saving");
      await sql`
        UPDATE perspectives
        SET audio_src = ${r2Key}, video_src = NULL, updated_at = NOW()
        WHERE id = ${data.perspectiveId};
      `;
      onProgress?.("done");
      return { ok: true as const, r2Key };
    }

    const isSourceAac = audioCodec === "aac";

    const outputPath = path.join(tmpRoot, "music.m4a");
    onProgress?.("converting");
    const ffResult = await runCmd([
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", sourcePath,
      "-vn",
      "-movflags", "+faststart",
      "-ar", String(AUDIO_SAMPLE_RATE),
      "-ac", String(AUDIO_CHANNELS),
      ...(isSourceAac
        ? ["-c:a", "copy"]
        : ["-c:a", "aac", "-b:a", `${AUDIO_BITRATE_KBPS}k`]),
      outputPath,
    ], AUDIO_CONVERT_TIMEOUT_MS, "Audio conversion");

    if (ffResult.exitCode !== 0) {
      return {
        ok: false as const,
        error: `Conversion failed: ${ffResult.stderr.slice(0, 200)}`,
        status: 502,
      };
    }

    onProgress?.("uploading");

    const bunRuntime = getBunRuntime();
    const outputFile = bunRuntime.file(outputPath);
    const outputBytes = Buffer.from(await outputFile.arrayBuffer());
    const r2Key = buildR2Key("music.m4a");

    await putR2Object({
      key: r2Key,
      contentType: "audio/mp4",
      body: outputBytes,
    });

    if (videoUploadPromise) {
      onProgress?.("storing_video");
      await videoUploadPromise;
      if (videoUploadError) {
        throw videoUploadError;
      }
    }

    onProgress?.("saving");
    await sql`
      UPDATE perspectives
      SET audio_src = ${r2Key}, video_src = ${videoR2Key}, updated_at = NOW()
      WHERE id = ${data.perspectiveId};
    `;

    onProgress?.("done");

    return { ok: true as const, r2Key };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};

export const deleteAudio = async (
  data: Pick<z.infer<typeof audioImportSchema>, "actionToken" | "topicId" | "perspectiveId">,
) => {
  const check = await verifyPerspective(data);
  if (!check.ok) return check;

  await sql`
    UPDATE perspectives
    SET audio_src = NULL, video_src = NULL, updated_at = NOW()
    WHERE id = ${data.perspectiveId};
  `;

  return { ok: true as const };
};
