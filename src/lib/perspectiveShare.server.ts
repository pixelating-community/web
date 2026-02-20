import "@tanstack/react-start/server-only";
import { z } from "zod/v4";
import { verifyActionToken } from "@/lib/actionToken.server";
import { sql } from "@/lib/db.server";
import { getRequestId } from "@/lib/requestId";
import {
  createReflectionAccessToken,
  createReflectionWriteToken,
  formatPerspectiveShareCode,
  generatePerspectiveShareCode,
  getReflectionWriteCookieName,
  hashPerspectiveShareCode,
  verifyReflectionAccessToken,
  verifyReflectionWriteToken,
} from "@/lib/reflectionAccess";
import { getRequestCookie } from "@/server/lib/requestCookies";

const MAX_SHARE_USES = 2;

const buildCookie = ({
  name,
  value,
  maxAgeSeconds,
}: {
  name: string;
  value: string;
  maxAgeSeconds: number;
}) => {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
};

const buildCollaborationCookies = (perspectiveId: string) => {
  const maxAgeSeconds = 10 * 365 * 24 * 60 * 60;
  const accessToken = createReflectionAccessToken(perspectiveId);
  const writeToken = createReflectionWriteToken(perspectiveId);
  if (!accessToken || !writeToken) {
    return null;
  }
  return [
    buildCookie({
      name: `p_${perspectiveId}`,
      value: accessToken,
      maxAgeSeconds,
    }),
    buildCookie({
      name: getReflectionWriteCookieName(perspectiveId),
      value: writeToken,
      maxAgeSeconds,
    }),
  ];
};

const hasPerspectiveGrant = ({
  request,
  perspectiveId,
}: {
  request: Request;
  perspectiveId: string;
}) => {
  const accessToken = getRequestCookie(request, `p_${perspectiveId}`);
  const writeToken = getRequestCookie(
    request,
    getReflectionWriteCookieName(perspectiveId),
  );
  return (
    verifyReflectionAccessToken(accessToken, perspectiveId) &&
    verifyReflectionWriteToken(writeToken, perspectiveId)
  );
};

const createFailure = ({
  requestId,
  error,
  code,
  status,
}: {
  requestId: string;
  error: string;
  code?: string;
  status: number;
}) => ({
  ok: false as const,
  error,
  code,
  requestId,
  status,
});

const verifyPerspectiveShareAction = async ({
  actionToken,
  perspectiveId,
  requestId,
  topicId,
}: {
  actionToken: string;
  perspectiveId: string;
  requestId: string;
  topicId: string;
}) => {
  const verified = verifyActionToken({
    token: actionToken,
    requiredScope: "perspective:share",
    topicId,
  });
  if (!verified) {
    return createFailure({
      requestId,
      error: "Unauthorized",
      code: "INVALID_ACTION_TOKEN",
      status: 401,
    });
  }

  const rows = await sql<{ topic_id: string }>`
    SELECT topic_id
    FROM perspectives
    WHERE id = ${perspectiveId}
    LIMIT 1;
  `;
  if (rows.length === 0) {
    return createFailure({
      requestId,
      error: "Perspective not found",
      status: 404,
    });
  }
  if (rows[0]?.topic_id !== topicId) {
    return createFailure({
      requestId,
      error: "Unauthorized",
      code: "INVALID_ACTION_TOKEN",
      status: 401,
    });
  }

  return null;
};

export const loadPerspectiveShareStatusSchema = z.object({
  actionToken: z.string().min(1),
  perspectiveId: z.uuid(),
  topicId: z.uuid(),
});

export const generatePerspectiveShareCodeSchema = z.object({
  actionToken: z.string().min(1),
  perspectiveId: z.uuid(),
  topicId: z.uuid(),
});

export const redeemPerspectiveShareCodeSchema = z.object({
  code: z.string().min(1),
  perspectiveId: z.uuid(),
});

export const loadPerspectiveShareStatusServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof loadPerspectiveShareStatusSchema>;
}) => {
  const requestId = getRequestId(request);
  const actionError = await verifyPerspectiveShareAction({
    actionToken: data.actionToken,
    perspectiveId: data.perspectiveId,
    requestId,
    topicId: data.topicId,
  });
  if (actionError) return actionError;

  const rows = await sql<{
    created_at: string;
    max_uses: number;
    used_count: number;
  }>`
    SELECT created_at, max_uses, used_count
    FROM perspective_collaboration_codes
    WHERE perspective_id = ${data.perspectiveId}
      AND revoked_at IS NULL
    LIMIT 1;
  `;

  const row = rows[0];
  const remainingUses = row
    ? Math.max(0, Number(row.max_uses ?? MAX_SHARE_USES) - Number(row.used_count ?? 0))
    : 0;

  return {
    ok: true as const,
    data: {
      createdAt: row?.created_at ?? null,
      hasActiveCode: Boolean(row),
      remainingUses,
    },
  };
};

export const generatePerspectiveShareCodeServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof generatePerspectiveShareCodeSchema>;
}) => {
  const requestId = getRequestId(request);
  const actionError = await verifyPerspectiveShareAction({
    actionToken: data.actionToken,
    perspectiveId: data.perspectiveId,
    requestId,
    topicId: data.topicId,
  });
  if (actionError) return actionError;

  let code = "";
  let codeHash = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    code = generatePerspectiveShareCode();
    codeHash = hashPerspectiveShareCode(code);
    if (codeHash) break;
  }
  if (!code || !codeHash) {
    return createFailure({
      requestId,
      error: "Missing access secret",
      status: 500,
    });
  }

  await sql.begin(async (tx) => {
    await tx`
      SELECT id FROM perspectives
      WHERE id = ${data.perspectiveId}
      FOR UPDATE;
    `;
    await tx`
      UPDATE perspective_collaboration_codes
      SET revoked_at = NOW()
      WHERE perspective_id = ${data.perspectiveId}
        AND revoked_at IS NULL;
    `;
    await tx`
      INSERT INTO perspective_collaboration_codes (
        perspective_id,
        code_hash,
        max_uses,
        used_count
      )
      VALUES (
        ${data.perspectiveId},
        ${codeHash},
        ${MAX_SHARE_USES},
        0
      );
    `;
  });

  return {
    ok: true as const,
    data: {
      code: formatPerspectiveShareCode(code),
      remainingUses: MAX_SHARE_USES,
    },
  };
};

export const redeemPerspectiveShareCodeServer = async ({
  request,
  data,
}: {
  request: Request;
  data: z.infer<typeof redeemPerspectiveShareCodeSchema>;
}) => {
  const requestId = getRequestId(request);

  const perspectiveRows = await sql<{ id: string }>`
    SELECT id
    FROM perspectives
    WHERE id = ${data.perspectiveId}
    LIMIT 1;
  `;
  if (perspectiveRows.length === 0) {
    return createFailure({
      requestId,
      error: "Perspective not found",
      status: 404,
    });
  }

  if (hasPerspectiveGrant({ request, perspectiveId: data.perspectiveId })) {
    return {
      ok: true as const,
      data: {
        alreadyGranted: true,
      },
      setCookieHeaders: [] as string[],
    };
  }

  const codeHash = hashPerspectiveShareCode(data.code);
  if (!codeHash) {
    return createFailure({
      requestId,
      error: "🚫",
      status: 401,
    });
  }

  const redeemed = await sql.begin(async (tx) => {
    const rows = await tx<{
      id: string;
      max_uses: number;
      used_count: number;
    }>`
      SELECT id, max_uses, used_count
      FROM perspective_collaboration_codes
      WHERE perspective_id = ${data.perspectiveId}
        AND code_hash = ${codeHash}
        AND revoked_at IS NULL
      LIMIT 1
      FOR UPDATE;
    `;
    const row = rows[0];
    if (!row) return null;

    const maxUses = Number(row.max_uses ?? MAX_SHARE_USES);
    const usedCount = Number(row.used_count ?? 0);
    if (usedCount >= maxUses) {
      await tx`
        UPDATE perspective_collaboration_codes
        SET exhausted_at = COALESCE(exhausted_at, NOW())
        WHERE id = ${row.id};
      `;
      return null;
    }

    const nextUsedCount = usedCount + 1;
    const updatedRows = await tx`
      UPDATE perspective_collaboration_codes
      SET used_count = ${nextUsedCount},
          last_redeemed_at = NOW(),
          exhausted_at = CASE
            WHEN ${nextUsedCount} >= max_uses THEN NOW()
            ELSE exhausted_at
          END
      WHERE id = ${row.id}
      RETURNING id;
    `;
    return updatedRows[0] ?? null;
  });

  if (!redeemed) {
    return createFailure({
      requestId,
      error: "🚫",
      status: 401,
    });
  }

  const setCookieHeaders = buildCollaborationCookies(data.perspectiveId);
  if (!setCookieHeaders) {
    return createFailure({
      requestId,
      error: "Missing access secret",
      status: 500,
    });
  }

  return {
    ok: true as const,
    data: {
      alreadyGranted: false,
    },
    setCookieHeaders,
  };
};
