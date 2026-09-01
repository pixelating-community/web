import { sql } from "../src/lib/db.server";
import { extractR2Key } from "../src/lib/publicAudioBase";

type TopicRecord = {
  emoji: string | null;
  id: string;
  locked: boolean;
  name: string;
  short_title: string | null;
  token: string;
  updated_at: Date | string;
};

type PerspectiveRecord = {
  audio_mix_input_src: string | null;
  audio_mix_src: string | null;
  audio_src: string | null;
  end_time: number | null;
  id: string;
  image_src: string | null;
  parent_perspective_id: string | null;
  perspective: string;
  raw_recording_src: string | null;
  recording_src: string | null;
  remix_audio_src: string | null;
  remix_duration: number | null;
  remix_updated_at: Date | string | null;
  remix_waveform_json: unknown;
  rendered_html: string | null;
  start_time: number | null;
  symbols: unknown;
  topic_id: string | null;
  updated_at: Date | string;
  video_src: string | null;
  words_json: string | null;
};

type TopicBundle = {
  perspectives: PerspectiveRecord[];
  schemaVersion: 1;
  topic: TopicRecord;
};

const MEDIA_FIELDS = [
  "audio_mix_input_src",
  "audio_mix_src",
  "audio_src",
  "image_src",
  "raw_recording_src",
  "recording_src",
  "remix_audio_src",
  "video_src",
] as const satisfies ReadonlyArray<keyof PerspectiveRecord>;

const requireEnvironment = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const createR2Client = (bucket: string) =>
  new Bun.S3Client({
    accessKeyId: requireEnvironment("R2_ACCESS_KEY_ID"),
    bucket,
    endpoint: `https://${requireEnvironment("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    region: "auto",
    secretAccessKey: requireEnvironment("R2_SECRET_ACCESS_KEY"),
  });

const getSourceObjectOrigin = () => {
  const value = process.env.VITE_OBJ_BASE_URL?.trim();
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

const extractManagedR2Key = (value: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return extractR2Key(trimmed);

  try {
    const url = new URL(trimmed);
    const isR2Api = url.hostname.endsWith(".r2.cloudflarestorage.com");
    const isSourceObjectDomain = url.origin === getSourceObjectOrigin();
    return isR2Api || isSourceObjectDomain ? extractR2Key(trimmed) : null;
  } catch {
    return null;
  }
};

const loadTopic = async (topicName: string) => {
  const topics = await sql<TopicRecord>`
    SELECT id, updated_at, name, token, locked, short_title, emoji
    FROM topics
    WHERE name = ${topicName}
    LIMIT 1;
  `;
  const topic = topics[0];
  if (!topic) throw new Error(`Topic ${topicName} was not found.`);

  const perspectives = await sql<PerspectiveRecord>`
    SELECT
      id,
      updated_at,
      perspective,
      topic_id,
      audio_src,
      start_time,
      end_time,
      symbols,
      rendered_html,
      words_json,
      remix_audio_src,
      remix_duration,
      remix_waveform_json,
      remix_updated_at,
      video_src,
      recording_src,
      raw_recording_src,
      audio_mix_input_src,
      audio_mix_src,
      parent_perspective_id,
      image_src
    FROM perspectives
    WHERE topic_id = ${topic.id}
    ORDER BY id;
  `;

  return { perspectives, topic };
};

const getMediaKeys = (perspectives: PerspectiveRecord[]) =>
  [
    ...new Set(
      perspectives.flatMap((perspective) =>
        MEDIA_FIELDS.map((field) =>
          extractManagedR2Key(perspective[field] as string | null),
        ).filter((key): key is string => Boolean(key)),
      ),
    ),
  ];

const copyMedia = async (topicName: string, targetBucket: string) => {
  const { perspectives } = await loadTopic(topicName);
  const sourceClient = createR2Client(requireEnvironment("BUCKET_NAME"));
  const targetClient = createR2Client(targetBucket);
  const keys = getMediaKeys(perspectives);
  let copied = 0;
  let copiedBytes = 0;
  let missing = 0;
  let skipped = 0;

  for (const key of keys) {
    const source = sourceClient.file(key);
    if (!(await source.exists())) {
      missing += 1;
      continue;
    }

    const target = targetClient.file(key);
    if (await target.exists()) {
      skipped += 1;
      continue;
    }

    const sourceStat = await source.stat();
    const body = await source.arrayBuffer();
    await target.write(body, {
      type: sourceStat.type || "application/octet-stream",
    });
    const targetStat = await target.stat();
    if (Number(targetStat.size) !== Number(sourceStat.size)) {
      throw new Error(`Copied object size mismatch for ${key}.`);
    }
    copied += 1;
    copiedBytes += Number(sourceStat.size ?? 0);
  }

  console.log(
    JSON.stringify({
      copied,
      copiedBytes,
      missing,
      skipped,
      targetBucket,
      topicName,
      total: keys.length,
    }),
  );
};

const exportTopic = async (topicName: string) => {
  const { perspectives, topic } = await loadTopic(topicName);
  const sourceClient = createR2Client(requireEnvironment("BUCKET_NAME"));
  const existence = new Map<string, boolean>();
  let omittedMediaReferences = 0;

  const exportedPerspectives: PerspectiveRecord[] = [];
  for (const perspective of perspectives) {
    const exported = { ...perspective };
    for (const field of MEDIA_FIELDS) {
      const value = perspective[field] as string | null;
      const key = extractManagedR2Key(value);
      if (!key) continue;
      let exists = existence.get(key);
      if (exists === undefined) {
        exists = await sourceClient.file(key).exists();
        existence.set(key, exists);
      }
      exported[field] = exists ? key : null;
      if (!exists) {
        omittedMediaReferences += 1;
        if (field === "remix_audio_src") {
          exported.remix_duration = null;
          exported.remix_updated_at = null;
          exported.remix_waveform_json = null;
        }
      }
    }
    exportedPerspectives.push(exported);
  }

  if (omittedMediaReferences > 0) {
    console.error(
      `Omitted ${omittedMediaReferences} missing media reference(s) from ${topicName}.`,
    );
  }
  const bundle: TopicBundle = {
    perspectives: exportedPerspectives,
    schemaVersion: 1,
    topic,
  };
  console.log(JSON.stringify(bundle));
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseBundle = (raw: string, expectedTopicName: string): TopicBundle => {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || parsed.schemaVersion !== 1) {
    throw new Error("Unsupported or invalid topic bundle.");
  }
  if (!isRecord(parsed.topic) || parsed.topic.name !== expectedTopicName) {
    throw new Error("Topic bundle name does not match the requested topic.");
  }
  if (!Array.isArray(parsed.perspectives)) {
    throw new Error("Topic bundle perspectives are invalid.");
  }
  return parsed as TopicBundle;
};

const importPerspective = async (
  tx: typeof sql,
  perspective: PerspectiveRecord,
) => {
  const symbols = JSON.stringify(perspective.symbols ?? []);
  const waveform = perspective.remix_waveform_json === null
    ? null
    : JSON.stringify(perspective.remix_waveform_json);
  await tx`
    INSERT INTO perspectives (
      id,
      updated_at,
      perspective,
      topic_id,
      audio_src,
      start_time,
      end_time,
      symbols,
      rendered_html,
      words_json,
      remix_audio_src,
      remix_duration,
      remix_waveform_json,
      remix_updated_at,
      video_src,
      recording_src,
      raw_recording_src,
      audio_mix_input_src,
      audio_mix_src,
      parent_perspective_id,
      image_src
    )
    VALUES (
      ${perspective.id},
      ${perspective.updated_at},
      ${perspective.perspective},
      ${perspective.topic_id},
      ${perspective.audio_src},
      ${perspective.start_time},
      ${perspective.end_time},
      ${symbols}::jsonb,
      ${perspective.rendered_html},
      ${perspective.words_json},
      ${perspective.remix_audio_src},
      ${perspective.remix_duration},
      ${waveform}::jsonb,
      ${perspective.remix_updated_at},
      ${perspective.video_src},
      ${perspective.recording_src},
      ${perspective.raw_recording_src},
      ${perspective.audio_mix_input_src},
      ${perspective.audio_mix_src},
      ${perspective.parent_perspective_id},
      ${perspective.image_src}
    );
  `;
};

const importTopic = async (topicName: string) => {
  const bundle = parseBundle(await Bun.stdin.text(), topicName);
  const { perspectives, topic } = bundle;
  const perspectiveIds = new Set(perspectives.map(({ id }) => id));
  if (perspectiveIds.size !== perspectives.length) {
    throw new Error("Topic bundle contains duplicate perspective IDs.");
  }
  for (const perspective of perspectives) {
    if (perspective.topic_id !== topic.id) {
      throw new Error("Topic bundle contains a perspective from another topic.");
    }
    if (
      perspective.parent_perspective_id &&
      !perspectiveIds.has(perspective.parent_perspective_id)
    ) {
      throw new Error("Topic bundle contains an external parent perspective.");
    }
  }

  await sql.begin(async (tx) => {
    const existing = await tx`
      SELECT id
      FROM topics
      WHERE id = ${topic.id} OR name = ${topic.name}
      LIMIT 1;
    `;
    if (existing.length > 0) {
      throw new Error(`Topic ${topic.name} already exists; import refused.`);
    }

    await tx`
      INSERT INTO topics (id, updated_at, name, token, locked, short_title, emoji)
      VALUES (
        ${topic.id},
        ${topic.updated_at},
        ${topic.name},
        ${topic.token},
        ${topic.locked},
        ${topic.short_title},
        ${topic.emoji}
      );
    `;

    const pending = new Map(perspectives.map((row) => [row.id, row]));
    const inserted = new Set<string>();
    while (pending.size > 0) {
      let insertedThisPass = 0;
      for (const [id, perspective] of pending) {
        const parentId = perspective.parent_perspective_id;
        if (parentId && !inserted.has(parentId)) continue;
        await importPerspective(tx as typeof sql, perspective);
        inserted.add(id);
        pending.delete(id);
        insertedThisPass += 1;
      }
      if (insertedThisPass === 0) {
        throw new Error("Topic bundle contains a parent-reference cycle.");
      }
    }
  });

  console.log(
    JSON.stringify({ imported: true, perspectives: perspectives.length, topicName }),
  );
};

const main = async () => {
  const [action, topicName, targetBucketArg] = process.argv.slice(2);
  if (!topicName?.trim()) {
    throw new Error(
      "Usage: bun scripts/promote-topic.ts <copy-media|export|import> <topic> [target-bucket]",
    );
  }

  if (action === "copy-media") {
    const targetBucket = targetBucketArg?.trim() || process.env.PROMOTE_TARGET_BUCKET?.trim();
    if (!targetBucket) throw new Error("A target bucket is required.");
    await copyMedia(topicName.trim(), targetBucket);
    return;
  }
  if (action === "export") {
    await exportTopic(topicName.trim());
    return;
  }
  if (action === "import") {
    await importTopic(topicName.trim());
    return;
  }
  throw new Error(`Unknown topic promotion action: ${action ?? ""}.`);
};

try {
  await main();
} finally {
  await sql.close?.();
}
