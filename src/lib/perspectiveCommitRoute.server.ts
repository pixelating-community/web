import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { PERSPECTIVE_ALIGN_ACTION_SCOPES } from "@/lib/actionToken";
import { issueActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import { getRequestId } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";
import {
  resolveStoredTopicToken,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";

export type CommitMeta = {
  perspectiveId: string;
  perspectiveText: string;
  topicId: string;
  topicName: string;
  actionToken?: string;
};

export type CommitRouteLoaderData = {
  data: CommitMeta | null;
  error: string;
};

export const loadPerspectiveCommitMetaServer = async ({
  id,
  request,
}: {
  id: string;
  request?: Request;
}): Promise<CommitRouteLoaderData> => {
  const schema = z.object({ id: z.uuid() });
  let parsed: { id: string };

  try {
    parsed = schema.parse({ id });
  } catch {
    return { data: null, error: "Invalid id" };
  }

  try {
    const rows = await sql<{
      perspective_id: string;
      perspective_text: string;
      topic_id: string;
      topic_name: string;
      topic_token?: string | null;
      topic_locked?: boolean | null;
    }>`
      SELECT
        p.id AS perspective_id,
        p.perspective AS perspective_text,
        t.id AS topic_id,
        t.name AS topic_name,
        t.token AS topic_token,
        t.locked AS topic_locked
      FROM perspectives AS p
      JOIN topics AS t ON t.id = p.topic_id
      WHERE p.id = ${parsed.id}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      return { data: null, error: "Perspective not found" };
    }

    const row = rows[0];
    const isLocked = Boolean(row.topic_locked);
    const storedTopicToken = resolveStoredTopicToken(
      typeof row.topic_token === "string" ? row.topic_token : undefined,
    );
    const requiresWriteToken = topicRequiresWriteToken({
      locked: isLocked,
      storedToken: storedTopicToken,
    });
    let canWrite = !requiresWriteToken;

    if (requiresWriteToken && request) {
      const resolvedTokenCookie = resolveTopicTokenCookieFromRequest({
        request,
        topicId: row.topic_id,
        topicName: row.topic_name,
      });
      canWrite = await verifyTopicToken(
        resolvedTokenCookie?.value ?? "",
        storedTopicToken,
      );
    }
    const requestId = request ? getRequestId(request) : "server-fn";
    const actionToken = canWrite
      ? issueActionToken({
          scopes: PERSPECTIVE_ALIGN_ACTION_SCOPES,
          topicId: row.topic_id,
          requestId,
        })
      : null;

    return {
      data: {
        perspectiveId: row.perspective_id,
        perspectiveText: String(row.perspective_text ?? ""),
        topicId: row.topic_id,
        topicName: row.topic_name,
        actionToken: actionToken ?? undefined,
      },
      error: "",
    };
  } catch (error) {
    console.error(error, { message: "Failed to load commit metadata" });
    return { data: null, error: "Failed to load perspective" };
  }
};
