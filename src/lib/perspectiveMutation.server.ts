import "@tanstack/react-start/server-only";
import * as z from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import { getRequestId } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveStoredTopicToken, topicRequiresWriteToken } from "@/lib/topicWriteAccess";
import { isTopicLockedMessage, resolveTopicWriteToken, TOPIC_LOCKED_RESPONSE } from "@/lib/topicWriteToken";
import { addPerspective } from "@/lib/addPerspective.server";
import { editPerspective } from "@/lib/editPerspective.server";


type PerspectiveMutationResult =
  | { ok: true }
  | { ok: false; error: string; code?: string; requestId: string };

const createFailure = ({
  requestId,
  error,
  code,
}: {
  requestId: string;
  error: string;
  code?: string;
}): PerspectiveMutationResult => ({
  ok: false,
  error,
  code,
  requestId,
});

const verifyTopicScopedActionToken = ({
  actionToken,
  requestId,
  requiredScope,
  topicId,
}: {
  actionToken?: string;
  requestId: string;
  requiredScope: "perspective:add" | "perspective:edit" | "perspective:delete";
  topicId: string;
}): PerspectiveMutationResult | null => {
  const verified = verifyActionToken({
    token: actionToken ?? "",
    requiredScope,
    topicId,
  });
  if (verified) return null;
  return createFailure({
    requestId,
    error: "Unauthorized",
    code: "INVALID_ACTION_TOKEN",
  });
};

const topicLockedFailure = (requestId: string) =>
  createFailure({
    requestId,
    error: TOPIC_LOCKED_RESPONSE.error,
    code: TOPIC_LOCKED_RESPONSE.code,
  });

const addPerspectiveSchema = z.object({
  actionToken: z.string().min(1),
  audioSrc: z.string().trim().min(1).optional(),
  imageSrc: z.string().trim().min(1).optional(),
  perspective: z.string().min(1),
  topicId: z.uuid(),
  topicName: z.string().trim().min(1),
  parentPerspectiveId: z.uuid().optional(),
});

const editPerspectiveSchema = z.object({
  actionToken: z.string().min(1),
  audioSrc: z.string().trim().optional(),
  imageSrc: z.string().trim().optional(),
  perspective: z.string().min(1),
  perspectiveId: z.uuid(),
  topicId: z.uuid(),
  topicName: z.string().trim().min(1),
});

const deletePerspectiveSchema = z.object({
  actionToken: z.string().min(1),
  perspectiveId: z.uuid(),
  topicId: z.uuid(),
});

const resolvePerspectiveTopic = async (perspectiveId: string) => {
  const rows = await sql<{
    topic_id: string;
    topic_locked?: boolean | null;
    topic_name: string;
    topic_token?: string | null;
  }>`
    SELECT
      t.id AS topic_id,
      t.locked AS topic_locked,
      t.name AS topic_name,
      t.token AS topic_token
    FROM perspectives AS p
    JOIN topics AS t ON t.id = p.topic_id
    WHERE p.id = ${perspectiveId}
    LIMIT 1;
  `;

  return rows[0] ?? null;
};

export const createPerspectiveServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof addPerspectiveSchema>;
}): Promise<PerspectiveMutationResult> => {
  const requestId = getRequestId(request);
  const actionTokenError = verifyTopicScopedActionToken({
    actionToken: data.actionToken,
    requestId,
    requiredScope: "perspective:add",
    topicId: data.topicId,
  });
  if (actionTokenError) return actionTokenError;

  const formData = new FormData();
  formData.set("perspective", data.perspective);
  if (data.audioSrc) {
    formData.set("audio_src", data.audioSrc);
  }
  if (data.imageSrc) {
    formData.set("image_src", data.imageSrc);
  }
  const resolvedToken = resolveTopicWriteToken({
    request,
    topicId: data.topicId,
    topicName: data.topicName,
  });
  if (resolvedToken) {
    formData.set("token", resolvedToken);
  }

  const result = await addPerspective({
    topicId: data.topicId,
    name: data.topicName,
    formData,
    requestId,
    parentPerspectiveId: data.parentPerspectiveId,
  });
  if (result?.message) {
    if (isTopicLockedMessage(result.message)) {
      return topicLockedFailure(requestId);
    }
    return createFailure({
      requestId,
      error: result.message,
    });
  }

  return { ok: true };
};

export const updatePerspectiveServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof editPerspectiveSchema>;
}): Promise<PerspectiveMutationResult> => {
  const requestId = getRequestId(request);
  const actionTokenError = verifyTopicScopedActionToken({
    actionToken: data.actionToken,
    requestId,
    requiredScope: "perspective:edit",
    topicId: data.topicId,
  });
  if (actionTokenError) return actionTokenError;

  const row = await resolvePerspectiveTopic(data.perspectiveId);
  if (!row) {
    return createFailure({
      requestId,
      error: "Perspective not found",
    });
  }
  if (row.topic_id !== data.topicId) {
    return createFailure({
      requestId,
      error: "Unauthorized",
      code: "INVALID_ACTION_TOKEN",
    });
  }

  const formData = new FormData();
  formData.set("perspective", data.perspective);
  if (data.audioSrc !== undefined) {
    formData.set("audio_src", data.audioSrc);
  }
  if (data.imageSrc !== undefined) {
    formData.set("image_src", data.imageSrc);
  }
  const resolvedToken = resolveTopicWriteToken({
    request,
    topicId: row.topic_id,
    topicName: row.topic_name,
  });
  if (resolvedToken) {
    formData.set("token", resolvedToken);
  }

  const result = await editPerspective({
    id: data.perspectiveId,
    name: row.topic_name,
    formData,
    requestId,
  });
  if (result.message) {
    if (isTopicLockedMessage(result.message)) {
      return topicLockedFailure(requestId);
    }
    return createFailure({
      requestId,
      error: result.message,
    });
  }

  return { ok: true };
};

export const deletePerspectiveServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof deletePerspectiveSchema>;
}): Promise<PerspectiveMutationResult> => {
  const requestId = getRequestId(request);
  const actionTokenError = verifyTopicScopedActionToken({
    actionToken: data.actionToken,
    requestId,
    requiredScope: "perspective:delete",
    topicId: data.topicId,
  });
  if (actionTokenError) return actionTokenError;

  const row = await resolvePerspectiveTopic(data.perspectiveId);
  if (!row) {
    return createFailure({
      requestId,
      error: "Perspective not found",
    });
  }
  if (row.topic_id !== data.topicId) {
    return createFailure({
      requestId,
      error: "Unauthorized",
      code: "INVALID_ACTION_TOKEN",
    });
  }

  const storedTopicToken = resolveStoredTopicToken(
    typeof row.topic_token === "string" ? row.topic_token : undefined,
  );
  const requiresWriteToken = topicRequiresWriteToken({
    locked: Boolean(row.topic_locked),
    storedToken: storedTopicToken,
  });
  if (requiresWriteToken) {
    const resolvedToken = resolveTopicWriteToken({
      request,
      topicId: row.topic_id,
      topicName: row.topic_name,
    });
    const isValid =
      resolvedToken &&
      (await verifyTopicToken(resolvedToken, storedTopicToken));
    if (!isValid) {
      return topicLockedFailure(requestId);
    }
  }

  await sql`DELETE FROM perspectives WHERE id = ${data.perspectiveId};`;

  return { ok: true };
};
