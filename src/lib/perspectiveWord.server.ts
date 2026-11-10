import "@tanstack/react-start/server-only";
import type { z } from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import { decrypt, encrypt } from "@/lib/crypto";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenFromRequest } from "@/lib/topicTokenCookies";
import { topicRequiresWriteToken } from "@/lib/topicWriteAccess";
import { replacePerspectiveWord } from "@/lib/replacePerspectiveWord";
import { perspectiveWordSchema } from "@/lib/perspectiveWord.schema";
import type { WordTimingEntry } from "@/types/perspectives";

export const updatePerspectiveWordServer = async ({
  request,
  data: input,
}: {
  request: Request;
  data: z.infer<typeof perspectiveWordSchema>;
}) => {
  try {
    const data = perspectiveWordSchema.parse(input);
    const action = verifyActionToken({
      token: data.actionToken,
      requiredScope: "perspective:edit",
      topicId: data.topicId,
    });
    if (!action || action.perspectiveId) throw new Error("Unauthorized");
    const saved = await sql.begin(async (tx) => {
      const rows = await tx<{
        perspective: string;
        words_json: string | null;
        name: string;
        token: string;
        locked: boolean;
      }>`
        SELECT p.perspective, p.words_json, t.name, t.token, t.locked
        FROM perspectives p JOIN topics t ON t.id=p.topic_id
        WHERE p.id=${data.perspectiveId} AND p.topic_id=${data.topicId}
        FOR UPDATE OF p, t;
      `;
      const row = rows[0];
      if (!row) throw new Error("Perspective not found");
      const token = resolveTopicTokenFromRequest({
        request,
        topicId: data.topicId,
        topicName: row.name,
      });
      if (
        topicRequiresWriteToken({
          locked: row.locked,
          storedToken: row.token,
        }) &&
        (!token || !(await verifyTopicToken(token, row.token)))
      )
        throw new Error("Topic is locked");
      const text =
        row.locked && token ? decrypt(row.perspective, token) : row.perspective;
      const updated = replacePerspectiveWord({ text, ...data });
      const timingJson =
        row.words_json && row.locked && token
          ? decrypt(row.words_json, token)
          : row.words_json;
      const timings = timingJson
        ? (JSON.parse(timingJson) as WordTimingEntry[])
        : [];
      const nextTimings = timings.map((entry, index) =>
        index === data.index && entry
          ? { ...entry, word: updated.word }
          : entry,
      );
      const store = (value: string) =>
        row.locked && token ? encrypt(value, token) : value;
      await tx`UPDATE perspectives SET perspective=${store(updated.text)}, rendered_html=${store(updated.renderedHtml)}, words_json=${timingJson ? store(JSON.stringify(nextTimings)) : null}, updated_at=NOW() WHERE id=${data.perspectiveId}`;
      return {
        perspective: updated.text,
        rendered_html: updated.renderedHtml,
        words: updated.words,
        wordTimings: nextTimings,
      };
    });
    return { ok: true as const, data: saved };
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error ? error.message : "Could not save the word.",
    };
  }
};
