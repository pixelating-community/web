import "@tanstack/react-start/server-only";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import {
  normalizeKaraokePhrases,
  setKaraokePhrasesInSymbols,
} from "@/lib/karaokePhrases";
import { getRequestId } from "@/lib/requestId";

type SaveKaraokePhrasesArgs = {
  request: Request;
  data: {
    actionToken?: string;
    perspectiveId?: string;
    topicId?: string;
    phrases?: unknown;
  };
};

export const saveKaraokePhrasesServer = async ({
  request,
  data,
}: SaveKaraokePhrasesArgs) => {
  const requestId = getRequestId(request);

  const actionToken = data.actionToken?.trim() ?? "";
  const perspectiveId = data.perspectiveId?.trim() ?? "";
  const topicId = data.topicId?.trim() ?? "";

  if (!actionToken || !perspectiveId || !topicId) {
    return { ok: false as const, error: "Missing required fields", requestId };
  }

  const verified = verifyActionToken({
    token: actionToken,
    requiredScope: "perspective:align",
    topicId,
  });
  if (!verified) {
    return { ok: false as const, error: "Unauthorized", requestId };
  }

  const rows = await sql<{ symbols: unknown; topic_id: string }>`
    SELECT topic_id, symbols
    FROM perspectives
    WHERE id = ${perspectiveId}
    LIMIT 1;
  `;
  if (rows.length === 0 || rows[0]?.topic_id !== topicId) {
    return { ok: false as const, error: "Not found", requestId };
  }

  const phrases = normalizeKaraokePhrases(data.phrases ?? []);
  const symbols = setKaraokePhrasesInSymbols(rows[0]?.symbols, phrases);
  await sql`
    UPDATE perspectives
    SET symbols = ${JSON.stringify(symbols)}::jsonb
    WHERE id = ${perspectiveId};
  `;

  return {
    ok: true as const,
    phrases,
  };
};
