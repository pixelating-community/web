"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { isLocked } from "@/actions/isLocked";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";

export const addPerspective = async ({
  topicId,
  name,
  formData,
}: {
  topicId: string;
  name: string;
  formData: FormData;
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
      token: z.string().min(1),
      perspective: z.string().min(1),
      topicId: z.uuid(),
      name: z.string(),
      audio_src: z.string().min(1).nullable().optional(),
    });
    const data = schema.parse({
      token: formData.get("token"),
      perspective: formData.get("perspective"),
      topicId,
      name,
      audio_src: audioSrcValue,
    });
    const isLock = await isLocked({ id: topicId });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE id = ${topicId};
    `;
    const result = [];

    if (isLock) {
      data.perspective = encrypt(data.perspective, data.token);
    }

    if (isValid.length > 0 && isValid[0]["?column?"] === true) {
      await sql`
          INSERT INTO perspectives (perspective, topic_id, audio_src)
          VALUES (${data.perspective}, ${data.topicId}, ${data.audio_src});
        `;
    }

    revalidatePath(`/t/${name}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to create perspective" };
  }
};
