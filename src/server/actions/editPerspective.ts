import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { decrypt, encrypt } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { normalizeTimings } from "@/lib/perspectiveTimings";
import { preserveWordTimings } from "@/lib/preserveWordTimings";
import { verifyTopicToken } from "@/lib/topicToken";
import { getTopic } from "@/server/actions/getTopic";
import { revalidatePath } from "@/server/lib/revalidate";

export const editPerspective = async ({
  id,
  name,
  formData,
  requestId,
}: {
  id: string;
  name: string;
  formData: FormData;
  requestId?: string;
}): Promise<{ message?: string; result?: unknown }> => {
  try {
    const rawAudioSrc = formData.get("audio_src");
    const hasAudioSrc = formData.has("audio_src");
    const audioSrcValue =
      hasAudioSrc && typeof rawAudioSrc === "string"
        ? rawAudioSrc.trim()
        : null;
    const schema = z.object({
      id: z.uuid(),
      name: z.string().min(1),
      token: z.string().min(1).optional(),
      perspective: z.string().min(1),
      audio_src: z.string().min(1).nullable().optional(),
    });
    const rawToken = formData.get("token");
    const data = schema.parse({
      id,
      name,
      token: typeof rawToken === "string" ? rawToken : undefined,
      perspective: formData.get("perspective"),
      audio_src: hasAudioSrc ? audioSrcValue || null : undefined,
    });

    const topic = await getTopic({ name });
    if (!topic?.id) {
      return { message: "Topic not found" };
    }
    const topicId = String(topic.id);
    const locked = Boolean(topic.locked);
    const storedToken =
      typeof topic.token === "string" ? topic.token : undefined;
    if (!data.token) {
      console.warn("[topic-auth] Missing token on editPerspective", {
        requestId,
        perspectiveId: id,
        topicId,
        topicName: name,
      });
      return { message: "Invalid token" };
    }
    const isValid = await verifyTopicToken(data.token, storedToken);
    if (!isValid) {
      console.warn("[topic-auth] Invalid token on editPerspective", {
        requestId,
        perspectiveId: id,
        topicId,
        topicName: name,
      });
      return { message: "Invalid token" };
    }

    const plaintextPerspective = data.perspective;
    const compiled = compilePerspective(plaintextPerspective);
    const newWords = compiled.words;
    let renderedHtml = compiled.renderedHtml;
    const storedAudioSrc =
      data.audio_src === undefined
        ? undefined
        : locked && data.audio_src && data.token
          ? encrypt(data.audio_src, data.token)
          : data.audio_src;
    if (locked && data.token) {
      data.perspective = encrypt(data.perspective, data.token);
      renderedHtml = encrypt(renderedHtml, data.token);
    }

    const existingRows = await sql`
      SELECT perspective, words_json
      FROM perspectives
      WHERE id = ${id} AND topic_id = ${topicId}
      LIMIT 1;
    `;
    if (existingRows.length === 0) {
      return { message: "Perspective not found" };
    }

    const existingRow = existingRows[0];
    const existingPerspectiveRaw =
      typeof existingRow.perspective === "string"
        ? existingRow.perspective
        : "";
    const existingPerspective =
      locked && data.token
        ? decrypt(existingPerspectiveRaw, data.token)
        : existingPerspectiveRaw;

    const existingWordsJsonRaw =
      typeof existingRow.words_json === "string"
        ? existingRow.words_json
        : null;
    const existingWordsJson = existingWordsJsonRaw
      ? locked && data.token
        ? decrypt(existingWordsJsonRaw, data.token)
        : existingWordsJsonRaw
      : null;

    const existingTimings = existingWordsJson
      ? normalizeTimings(existingWordsJson)
      : [];
    const existingWords = compilePerspective(existingPerspective).words;
    const nextTimings = preserveWordTimings({
      oldTimings: existingTimings,
      oldWords: existingWords,
      newWords,
    });
    const nextWordsJsonPlain = nextTimings.some(Boolean)
      ? JSON.stringify(nextTimings)
      : null;
    const wordsJson =
      nextWordsJsonPlain && locked && data.token
        ? encrypt(nextWordsJsonPlain, data.token)
        : nextWordsJsonPlain;

    const result =
      data.audio_src !== undefined
        ? await sql`
            UPDATE perspectives
            SET perspective = ${data.perspective},
                audio_src = ${storedAudioSrc},
                rendered_html = ${renderedHtml},
                words_json = ${wordsJson}
            WHERE id = ${id};
          `
        : await sql`
            UPDATE perspectives
            SET perspective = ${data.perspective},
                rendered_html = ${renderedHtml},
                words_json = ${wordsJson}
            WHERE id = ${id};
          `;

    revalidatePath(`/t/${name}`, "page");
    return { result };
  } catch (e) {
    console.error("Failed to edit perspective", e, {
      requestId,
      perspectiveId: id,
      topicName: name,
    });
    return { message: "Failed to edit perspective" };
  }
};
