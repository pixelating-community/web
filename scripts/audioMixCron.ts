import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SQL } from "bun";

const MUSIC_AUDIO_BITRATE_KBPS = 256;
const STALE_JOB_TIMEOUT_MS = 30 * 60 * 1000;

const resolveConnectionString = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) return databaseUrl;

  const host = process.env.POSTGRES_HOST ?? "postgres";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const username = process.env.POSTGRES_USER ?? "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? "postgres";
  const database = process.env.POSTGRES_DB ?? "postgres";

  return `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const getR2Client = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket =
    process.env.BUCKET_NAME ?? process.env.NEXT_PUBLIC_WAV_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2 configuration");
  }

  return new Bun.S3Client({
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    accessKeyId,
    secretAccessKey,
  });
};

const downloadR2File = async (
  r2Client: ReturnType<typeof getR2Client>,
  key: string,
  destPath: string,
) => {
  const url = r2Client.file(key).presign({ method: "GET", expiresIn: 600 });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${key}: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
};

const runCmd = async (cmd: string[], timeoutMs = 600_000) => {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Command timed out")), timeoutMs),
  );
  const [stdoutBytes, stderrBytes, exitCode] = await Promise.race([
    Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
      proc.exited,
    ]),
    timeout,
  ]);
  return {
    exitCode,
    stdout: Buffer.from(stdoutBytes).toString("utf8"),
    stderr: Buffer.from(stderrBytes).toString("utf8"),
  };
};

type JobRow = {
  id: string;
  perspective_id: string;
};

type SnippetRow = {
  id: string;
  r2_key: string;
  start_time: number;
  end_time: number;
};

const processJob = async (sql: InstanceType<typeof SQL>, job: JobRow) => {
  console.log(`[audio-mix] processing job=${job.id}`);

  await sql`
    UPDATE audio_mix_jobs
    SET status = 'processing', started_at = NOW()
    WHERE id = ${job.id};
  `;

  const tmpRoot = await mkdtemp(path.join(tmpdir(), "audio-mix-"));
  try {
    // Get audio mix input source
    const perspectiveRows = await sql`
      SELECT audio_mix_input_src FROM perspectives
      WHERE id = ${job.perspective_id}
      LIMIT 1;
    ` as { audio_mix_input_src: string | null }[];

    const audioMixInputSrc = perspectiveRows[0]?.audio_mix_input_src;
    if (!audioMixInputSrc) {
      throw new Error("No audio mix input source on perspective");
    }

    // Get snippets
    const snippets = await sql`
      SELECT id, r2_key, start_time, end_time
      FROM audio_mix_snippets
      WHERE perspective_id = ${job.perspective_id}
      ORDER BY start_time;
    ` as SnippetRow[];

    if (snippets.length === 0) {
      throw new Error("No snippets to mix");
    }

    const r2Client = getR2Client();

    // Download base audio
    const basePath = path.join(tmpRoot, "base.m4a");
    await downloadR2File(r2Client, audioMixInputSrc, basePath);

    // Download audio source (for the original audio track)
    const audioRows = await sql`
      SELECT audio_src FROM perspectives
      WHERE id = ${job.perspective_id}
      LIMIT 1;
    ` as { audio_src: string | null }[];
    const audioSrc = audioRows[0]?.audio_src;

    // Download each snippet
    const snippetPaths: { path: string; startTimeMs: number }[] = [];
    for (let i = 0; i < snippets.length; i++) {
      const snippet = snippets[i];
      const snippetPath = path.join(tmpRoot, `snippet${i}.m4a`);
      await downloadR2File(r2Client, snippet.r2_key, snippetPath);
      snippetPaths.push({
        path: snippetPath,
        startTimeMs: Math.round(snippet.start_time * 1000),
      });
    }

    // Build ffmpeg filter_complex for adelay + amix
    // Input 0 = base audio
    // If we have a separate audio source, use it as the base audio
    const inputs: string[] = ["-i", basePath];
    let audioInputIndex = 0;

    if (audioSrc) {
      const audioPath = path.join(tmpRoot, "audio.m4a");
      await downloadR2File(r2Client, audioSrc, audioPath);
      inputs.push("-i", audioPath);
      audioInputIndex = 1;
    }

    const snippetInputOffset = audioSrc ? 2 : 1;
    for (const sp of snippetPaths) {
      inputs.push("-i", sp.path);
    }

    const filterParts: string[] = [];
    const mixInputLabels: string[] = [`[${audioInputIndex}:a]`];

    for (let i = 0; i < snippetPaths.length; i++) {
      const inputIdx = snippetInputOffset + i;
      const label = `[s${i}]`;
      const delayMs = snippetPaths[i].startTimeMs;
      filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs}${label}`);
      mixInputLabels.push(label);
    }

    const totalInputs = mixInputLabels.length;
    // Use normalize=0 to prevent volume reduction as inputs increase
    filterParts.push(
      `${mixInputLabels.join("")}amix=inputs=${totalInputs}:duration=first:normalize=0[aout]`,
    );

    const filterComplex = filterParts.join(";");

    const outputPath = path.join(tmpRoot, "mixed.m4a");
    const ffResult = await runCmd([
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      ...inputs,
      "-filter_complex", filterComplex,
      "-map", "[aout]",
      "-c:a", "aac",
      "-b:a", `${MUSIC_AUDIO_BITRATE_KBPS}k`,
      "-movflags", "+faststart",
      outputPath,
    ]);

    if (ffResult.exitCode !== 0) {
      throw new Error(`ffmpeg failed: ${ffResult.stderr.slice(0, 500)}`);
    }

    // Upload mixed audio
    const outputFile = Bun.file(outputPath);
    const outputBytes = Buffer.from(await outputFile.arrayBuffer());
    const r2Key = `${crypto.randomUUID()}.m4a`;
    const r2File = r2Client.file(r2Key);
    await r2File.write(outputBytes, { type: "audio/mp4" });

    await sql`
      UPDATE audio_mix_jobs
      SET status = 'done', r2_key = ${r2Key}, completed_at = NOW()
      WHERE id = ${job.id};
    `;

    await sql`
      UPDATE perspectives
      SET audio_mix_src = ${r2Key}, updated_at = NOW()
      WHERE id = ${job.perspective_id};
    `;

    console.log(`[audio-mix] done job=${job.id} r2Key=${r2Key}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[audio-mix] error job=${job.id}`, message);

    await sql`
      UPDATE audio_mix_jobs
      SET status = 'error', error = ${message.slice(0, 1000)}, completed_at = NOW()
      WHERE id = ${job.id};
    `;
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
};

const processQueue = async () => {
  const sql = new SQL(resolveConnectionString());

  try {
    const staleThreshold = new Date(Date.now() - STALE_JOB_TIMEOUT_MS).toISOString();
    await sql`
      UPDATE audio_mix_jobs
      SET status = 'pending', started_at = NULL
      WHERE status = 'processing'
        AND started_at < ${staleThreshold}::timestamptz;
    `;

    const jobs = await sql`
      UPDATE audio_mix_jobs
      SET status = 'processing', started_at = NOW()
      WHERE id = (
        SELECT id FROM audio_mix_jobs
        WHERE status = 'pending'
        ORDER BY created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, perspective_id;
    ` as JobRow[];

    if (jobs.length === 0) {
      return { processed: 0 };
    }

    await processJob(sql, jobs[0]);
    return { processed: 1 };
  } finally {
    await sql.close();
  }
};

type ScheduledControllerLike = {
  scheduledTime?: number;
};

const scheduled = async (_controller?: ScheduledControllerLike) => {
  const result = await processQueue();
  if (result.processed > 0) {
    console.log(`[audio-mix-cron] processed=${result.processed}`);
  }
};

export default { scheduled };

if (import.meta.main) {
  const result = await processQueue();
  console.log(`[audio-mix] manual run processed=${result.processed}`);
}
