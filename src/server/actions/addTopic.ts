import { z } from "zod/v4";
import { decrypt, encrypt } from "@/lib/crypto";
import { sql } from "@/lib/db";
import { hashTopicToken, verifyTopicToken } from "@/lib/topicToken";

const normalizeKey = (value: string | undefined) => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const toBoolean = (value: unknown) =>
  value === true || value === "t" || value === 1 || value === "1";

export const addTopic = async ({
  name,
  key,
  token,
  locked,
  overwrite,
  shortTitle,
  emoji,
}: {
  name: string;
  key?: string;
  token: string;
  locked?: boolean;
  overwrite?: boolean;
  shortTitle?: string;
  emoji?: string;
}): Promise<{ created: boolean; name: string } | { message: string }> => {
  const tokenKeys = [process.env.TS_KEY, process.env.EL_KEY]
    .map((value) => normalizeKey(value))
    .filter((value): value is string => value.length > 0);
  const enforceAdminKey = process.env.NODE_ENV === "production";
  try {
    const schema = z.object({
      name: z.string().min(1),
      key: z.string().optional(),
      token: z.string().min(1),
      locked: z.boolean().optional(),
      overwrite: z.boolean().optional(),
      shortTitle: z.string().max(64).optional(),
      emoji: z.string().max(16).optional(),
    });
    const data = schema.parse({
      name,
      key: normalizeKey(key),
      token,
      locked: locked ?? false,
      overwrite: overwrite ?? false,
      shortTitle:
        typeof shortTitle === "string" && shortTitle.trim().length > 0
          ? shortTitle.trim()
          : undefined,
      emoji:
        typeof emoji === "string" && emoji.trim().length > 0
          ? emoji.trim()
          : undefined,
    });
    if (enforceAdminKey && !tokenKeys.includes(data.key ?? "")) {
      return { message: "invalid key" };
    }

    const existing = await sql`
      SELECT id, name, token, locked
      FROM topics
      WHERE name = ${data.name}
      LIMIT 1;
    `;

    if (existing.length > 0) {
      if (!data.overwrite) {
        return { message: `topic: ${data.name} exists already` };
      }

      const existingTopicId = String((existing[0] as { id?: string }).id ?? "");
      if (!existingTopicId) {
        return { message: "failed to reset topic" };
      }
      const existingToken =
        typeof (existing[0] as { token?: unknown }).token === "string"
          ? ((existing[0] as { token: string }).token ?? "")
          : "";
      const existingLocked = toBoolean(
        (existing[0] as { locked?: unknown }).locked,
      );
      const tokenUnchanged = await verifyTopicToken(data.token, existingToken);
      const hashedToken = await hashTopicToken(data.token);
      const updated = await sql.begin(async (tx) => {
        if (existingLocked && !tokenUnchanged) {
          // Existing locked rows are encrypted with the old token; key changed.
          await tx`
            DELETE FROM perspectives
            WHERE topic_id = ${existingTopicId};
          `;
        } else if (!existingLocked && data.locked) {
          // Plaintext -> locked: encrypt existing rows with the new token.
          const rows = await tx`
            SELECT id, perspective, rendered_html, words_json, audio_src
            FROM perspectives
            WHERE topic_id = ${existingTopicId};
          `;
          for (const row of rows as Array<{
            id: string;
            perspective: string;
            rendered_html?: string | null;
            words_json?: string | null;
            audio_src?: string | null;
          }>) {
            const nextPerspective = encrypt(row.perspective ?? "", data.token);
            const nextRenderedHtml =
              typeof row.rendered_html === "string" && row.rendered_html.length
                ? encrypt(row.rendered_html, data.token)
                : (row.rendered_html ?? null);
            const nextWordsJson =
              typeof row.words_json === "string" && row.words_json.length
                ? encrypt(row.words_json, data.token)
                : (row.words_json ?? null);
            const nextAudioSrc =
              typeof row.audio_src === "string" && row.audio_src.length
                ? encrypt(row.audio_src, data.token)
                : (row.audio_src ?? null);
            await tx`
              UPDATE perspectives
              SET perspective = ${nextPerspective},
                  rendered_html = ${nextRenderedHtml},
                  words_json = ${nextWordsJson},
                  audio_src = ${nextAudioSrc}
              WHERE id = ${row.id};
            `;
          }
        } else if (existingLocked && !data.locked && tokenUnchanged) {
          // Locked -> plaintext with same token: decrypt existing rows.
          const rows = await tx`
            SELECT id, perspective, rendered_html, words_json, audio_src
            FROM perspectives
            WHERE topic_id = ${existingTopicId};
          `;
          for (const row of rows as Array<{
            id: string;
            perspective: string;
            rendered_html?: string | null;
            words_json?: string | null;
            audio_src?: string | null;
          }>) {
            const nextPerspective = decrypt(row.perspective ?? "", data.token);
            const nextRenderedHtml =
              typeof row.rendered_html === "string" && row.rendered_html.length
                ? decrypt(row.rendered_html, data.token)
                : (row.rendered_html ?? null);
            const nextWordsJson =
              typeof row.words_json === "string" && row.words_json.length
                ? decrypt(row.words_json, data.token)
                : (row.words_json ?? null);
            const nextAudioSrc =
              typeof row.audio_src === "string" && row.audio_src.length
                ? decrypt(row.audio_src, data.token)
                : (row.audio_src ?? null);
            await tx`
              UPDATE perspectives
              SET perspective = ${nextPerspective},
                  rendered_html = ${nextRenderedHtml},
                  words_json = ${nextWordsJson},
                  audio_src = ${nextAudioSrc}
              WHERE id = ${row.id};
            `;
          }
        }

        const rows = await tx`
          UPDATE topics
          SET token = ${hashedToken},
              locked = ${data.locked},
              short_title = ${data.shortTitle ?? null},
              emoji = ${data.emoji ?? null},
              updated_at = NOW()
          WHERE id = ${existingTopicId}
          RETURNING name;
        `;
        return rows;
      });

      return {
        created: false,
        name: String((updated[0] as { name?: string }).name ?? data.name),
      };
    }

    const hashedToken = await hashTopicToken(data.token);
    const inserted = await sql`
      INSERT INTO topics (name, short_title, emoji, token, locked)
      VALUES (
        ${data.name},
        ${data.shortTitle ?? null},
        ${data.emoji ?? null},
        ${hashedToken},
        ${data.locked}
      )
      RETURNING name;
    `;

    if (inserted.length > 0) {
      return {
        created: true,
        name: String((inserted[0] as { name?: string }).name ?? data.name),
      };
    }

    return { message: "failed to create topic" };
  } catch (e) {
    console.log(e, { message: "Failed to add topic" });
    return { message: "failed to add topic" };
  }
};
