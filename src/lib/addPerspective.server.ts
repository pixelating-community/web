import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { compilePerspective } from "@/lib/compilePerspective";
import { encrypt } from "@/lib/crypto";
import { sql } from "@/lib/db.server";
import { verifyTopicToken } from "@/lib/topicToken";
import {
  resolveStoredTopicToken,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";


export const addPerspective = async ({
  topicId,
  name,
  formData,
  requestId,
  parentPerspectiveId,
}: {
  topicId: string;
  name: string;
  formData: FormData;
  requestId?: string;
  parentPerspectiveId?: string;
}) => {
  try {
    const rawAudioSrc = formData.get("audio_src");
    const audioSrcValue =
      typeof rawAudioSrc === "string" && rawAudioSrc.trim().length > 0
        ? rawAudioSrc.trim()
        : null;
    const rawImageSrc = formData.get("image_src");
    const imageSrcValue =
      typeof rawImageSrc === "string" && rawImageSrc.trim().length > 0
        ? rawImageSrc.trim()
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
      image_src: z.string().min(1).nullable().optional(),
    });
    const rawToken = formData.get("token");
    const data = schema.parse({
      token: typeof rawToken === "string" ? rawToken : undefined,
      perspective: formData.get("perspective"),
      topicId,
      name,
      audio_src: audioSrcValue,
      image_src: imageSrcValue,
    });
    const compiled = compilePerspective(data.perspective);
    let renderedHtml = compiled.renderedHtml;
    const wordsJson = null;
    const token = data.token;
    let verifiedToken: string | null = null;
    const topicRows = await sql`
      SELECT token, locked FROM topics WHERE id = ${topicId} LIMIT 1;
    `;
    const isLock = Boolean(topicRows[0]?.locked);
    const storedTopicToken = resolveStoredTopicToken(
      typeof topicRows[0]?.token === "string" ? topicRows[0].token : undefined,
    );
    const requiresWriteToken = topicRequiresWriteToken({
      locked: isLock,
      storedToken: storedTopicToken,
    });
    if (requiresWriteToken) {
      if (!token) {
        console.warn("[topic-auth] Missing token on addPerspective", {
          requestId,
          topicId,
          topicName: name,
        });
        return { message: "Invalid token" };
      }

      const isValid = await verifyTopicToken(
        token,
        storedTopicToken,
      );
      if (!isValid) {
        console.warn("[topic-auth] Invalid token on addPerspective", {
          requestId,
          topicId,
          topicName: name,
        });
        return { message: "Invalid token" };
      }
      verifiedToken = token;
    }

    if (isLock && verifiedToken) {
      data.perspective = encrypt(data.perspective, verifiedToken);
      renderedHtml = encrypt(renderedHtml, verifiedToken);
      if (data.audio_src) {
        data.audio_src = encrypt(data.audio_src, verifiedToken);
      }
      if (data.image_src) {
        data.image_src = encrypt(data.image_src, verifiedToken);
      }
    }

    await sql`
      INSERT INTO perspectives (perspective, topic_id, audio_src, image_src, rendered_html, words_json, parent_perspective_id)
      VALUES (${data.perspective}, ${data.topicId}, ${data.audio_src}, ${data.image_src}, ${renderedHtml}, ${wordsJson}, ${parentPerspectiveId ?? null});
    `;


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
