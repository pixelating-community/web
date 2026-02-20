import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { encrypt } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { verifyTopicToken } from "@/lib/topicToken";
import { revalidatePath } from "@/server/lib/revalidate";

export const addPerspective = async ({
  topicId,
  name,
  formData,
  requestId,
}: {
  topicId: string;
  name: string;
  formData: FormData;
  requestId?: string;
}) => {
  try {
    const rawAudioSrc = formData.get("audio_src");
    const audioSrcValue =
      typeof rawAudioSrc === "string" && rawAudioSrc.trim().length > 0
        ? rawAudioSrc.trim()
        : null;
    if (!topicId) {
      throw new Error("Topic not found");
    }
    const schema = z.object({
      token: z.string().min(1).optional(),
      perspective: z.string().min(1),
      topicId: z.uuid(),
      name: z.string(),
      audio_src: z.string().min(1).nullable().optional(),
    });
    const rawToken = formData.get("token");
    const data = schema.parse({
      token: typeof rawToken === "string" ? rawToken : undefined,
      perspective: formData.get("perspective"),
      topicId,
      name,
      audio_src: audioSrcValue,
    });
    const compiled = compilePerspective(data.perspective);
    let renderedHtml = compiled.renderedHtml;
    const wordsJson = null;
    const token = data.token;
    if (!token) {
      console.warn("[topic-auth] Missing token on addPerspective", {
        requestId,
        topicId,
        topicName: name,
      });
      return { message: "Invalid token" };
    }

    const topicRows = await sql`
      SELECT token, locked FROM topics WHERE id = ${topicId} LIMIT 1;
    `;
    const isLock = Boolean(topicRows[0]?.locked);
    const isValid = await verifyTopicToken(
      token,
      typeof topicRows[0]?.token === "string" ? topicRows[0].token : undefined,
    );
    if (!isValid) {
      console.warn("[topic-auth] Invalid token on addPerspective", {
        requestId,
        topicId,
        topicName: name,
      });
      return { message: "Invalid token" };
    }

    if (isLock) {
      data.perspective = encrypt(data.perspective, token);
      renderedHtml = encrypt(renderedHtml, token);
      if (data.audio_src) {
        data.audio_src = encrypt(data.audio_src, token);
      }
    }

    await sql`
      INSERT INTO perspectives (perspective, topic_id, audio_src, rendered_html, words_json)
      VALUES (${data.perspective}, ${data.topicId}, ${data.audio_src}, ${renderedHtml}, ${wordsJson});
    `;

    revalidatePath(`/t/${name}`, "page");
    return { ok: true };
  } catch (e) {
    console.error("Failed to create perspective", e, {
      requestId,
      topicId,
      topicName: name,
    });
    return { message: "Failed to create perspective" };
  }
};
