"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";

import { getTopic } from "@/actions/getTopic";
import { isLocked } from "@/actions/isLocked";
import { encrypt } from "@/lib/cryto";
import { sql } from "@/lib/db";

export const editPerspective = async ({
  id,
  name,
  formData,
}: {
  id: string;
  name: string;
  formData: FormData;
}): Promise<{ message?: string; result?: unknown }> => {
  try {
    const schema = z.object({
      id: z.uuid(),
      name: z.string().min(1),
      token: z.string().min(1),
      perspective: z.string().min(1),
    });
    const data = schema.parse({
      id,
      name,
      token: formData.get("token"),
      perspective: formData.get("perspective"),
    });

    const topic = await getTopic({ name });
    const locked = await isLocked({ id: topic.id });
    if (locked) {
      data.perspective = encrypt(data.perspective, data.token);
    }

    const isValid = await validateToken(data.token, topic.id);
    if (!isValid) return { message: "Invalid token" };

    const result = await sql`
      UPDATE perspectives SET perspective = ${data.perspective}
      WHERE id = ${id};
    `;

    revalidatePath(`/t/${name}`, "page");
    return { result };
  } catch (e) {
    console.log(e);
    return { message: "Failed to edit perspective" };
  }
};

const validateToken = async (token: string, topicId: string) => {
  const isValid = await sql`
    SELECT token = crypt(${token}, token) FROM topics WHERE id = ${topicId};
  `;
  return isValid.length > 0 && isValid[0]["?column?"] !== false;
};
