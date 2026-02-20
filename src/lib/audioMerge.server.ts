import "@tanstack/react-start/server-only";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildR2Key, getR2Object, putR2Object } from "@/lib/r2.server";

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
    options: { stderr: "pipe"; stdout: "pipe" },
  ) => BunSpawnProcLike;
};

const getBunRuntime = () => {
  const bunRuntime = (globalThis as { Bun?: BunRuntimeLike }).Bun;
  if (!bunRuntime) {
    throw new Error("Bun runtime is required for audio merge.");
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

/**
 * Merge a music track and a voice recording into a single audio file.
 * Music plays at reduced volume underneath the voice.
 */
export const mergeAudioTracks = async ({
  musicR2Key,
  voiceR2Key,
  voiceOffsetSeconds,
}: {
  musicR2Key: string;
  voiceR2Key: string;
  voiceOffsetSeconds?: number;
}): Promise<{ ok: true; r2Key: string; startTime: number } | { ok: false; error: string }> => {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "audio-merge-"));
  try {
    const [musicBuf, voiceBuf] = await Promise.all([
      getR2Object(musicR2Key),
      getR2Object(voiceR2Key),
    ]);

    const musicPath = path.join(tmpRoot, "music.m4a");
    const voicePath = path.join(tmpRoot, "voice.m4a");
    const outputPath = path.join(tmpRoot, "merged.m4a");

    await Promise.all([
      writeFile(musicPath, musicBuf),
      writeFile(voicePath, voiceBuf),
    ]);

    const offsetMs =
      typeof voiceOffsetSeconds === "number" && voiceOffsetSeconds > 0
        ? Math.round(voiceOffsetSeconds * 1000)
        : 0;
    // Music-forward mix: music at -14 LUFS, voice tucked underneath at -22 LUFS
    // Brighten voice for DJI Mic Mini: +4dB high shelf at 3.5kHz, +2dB presence at 5kHz
    const voiceEq = "treble=g=4:f=3500,equalizer=f=5000:t=q:w=1.2:g=2";
    const voiceChain = offsetMs > 0
      ? `[0:a]adelay=${offsetMs}|${offsetMs},${voiceEq},loudnorm=I=-22:TP=-1.5:LRA=11[voice]`
      : `[0:a]${voiceEq},loudnorm=I=-22:TP=-1.5:LRA=11[voice]`;
    const filter = `${voiceChain};[1:a]loudnorm=I=-14:TP=-1.5:LRA=11[music];[voice][music]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[out]`;
    const cmd = [
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "info",
      "-i",
      voicePath,
      "-i",
      musicPath,
      "-filter_complex",
      filter,
      "-map",
      "[out]",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      outputPath,
    ];
    console.log("ffmpeg cmd", cmd.join(" "));
    const result = await runCmd(cmd);
    console.log("ffmpeg exit", result.exitCode, result.stderr.slice(0, 500));

    if (result.exitCode !== 0) {
      return {
        ok: false,
        error: `Merge failed: ${result.stderr.slice(0, 300)}`,
      };
    }

    const bunRuntime = getBunRuntime();
    const outputBytes = Buffer.from(
      await bunRuntime.file(outputPath).arrayBuffer(),
    );
    const r2Key = buildR2Key("merged.m4a");
    await putR2Object({
      key: r2Key,
      contentType: "audio/mp4",
      body: outputBytes,
    });

    return { ok: true, r2Key, startTime: offsetMs / 1000 };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};
