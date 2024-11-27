"use server";

import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { z } from "zod";

export async function setCookie({
  token,
  topicId,
  perspectiveId,
}: {
  token: string;
  topicId: string;
  perspectiveId?: string;
}) {
  try {
    const schema = z.object({
      token: z.string().min(1),
      topicId: z.string().min(1),
      perspectiveId: z.string().nullish(),
    });
    const data = schema.parse({
      token,
      topicId,
      perspectiveId,
    });
    const isValid = await sql`
      SELECT token = crypt(${data.token}, token) FROM topics WHERE topic_id = ${data.topicId};
    `;
    if (isValid.length > 0 && isValid[0]["?column?"] === true) {
      const cookieStore = await cookies();
      if (perspectiveId) {
        cookieStore.set({
          name: `t_${data.topicId}`,
          value: `${data.token}`,
          httpOnly: true,
          path: `/p/${data.perspectiveId}/e`,
          secure: true,
          sameSite: "strict",
        });
      } else {
        cookieStore.set({
          name: `t_${data.topicId}`,
          value: `${data.token}`,
          httpOnly: true,
          path: `/t/${data.topicId}/w`,
          secure: true,
          sameSite: "strict",
        });
      }
    }
    return { message: "Incorrect token" };
  } catch (e) {
    console.log(e);
    return { message: "Failed to set cookie" };
  }
}
