import "@tanstack/react-start/server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ACTION_TOKEN_VERSION,
  type ActionScope,
  type ActionTokenPayload,
  actionTokenPayloadSchema,
} from "@/lib/actionToken";

const getSecret = () =>
  process.env.ACTION_TOKEN_SECRET?.trim() ||
  process.env.REFLECTION_ACCESS_SECRET?.trim() ||
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim() ||
  "";

export const hasActionTokenSecret = () => Boolean(getSecret());

const encodePayload = (payload: ActionTokenPayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

const signPayload = (encodedPayload: string, secret: string) =>
  createHmac("sha256", secret).update(encodedPayload).digest("base64url");

export const issueActionToken = ({
  scopes,
  topicId,
  requestId,
  perspectiveId,
  issuedAt = Date.now(),
}: {
  scopes: readonly ActionScope[];
  topicId: string;
  requestId: string;
  perspectiveId?: string;
  issuedAt?: number;
}) => {
  const secret = getSecret();
  if (!secret || scopes.length === 0) return null;

  const payload = actionTokenPayloadSchema.parse({
    version: ACTION_TOKEN_VERSION,
    scopes: [...scopes],
    topicId,
    perspectiveId,
    requestId,
    issuedAt,
  });
  const encodedPayload = encodePayload(payload);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

const decodePayload = (token: string) => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const secret = getSecret();
  if (!secret) return null;

  const expected = signPayload(encodedPayload, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    return actionTokenPayloadSchema.parse(JSON.parse(decoded));
  } catch {
    return null;
  }
};

export const verifyActionToken = ({
  token,
  requiredScope,
  topicId,
  perspectiveId,
}: {
  token: string;
  requiredScope: ActionScope;
  topicId?: string;
  perspectiveId?: string;
}) => {
  const payload = decodePayload(token);
  if (!payload) return null;
  if (!payload.scopes.includes(requiredScope)) return null;
  if (topicId && payload.topicId !== topicId) return null;
  if (perspectiveId && payload.perspectiveId && payload.perspectiveId !== perspectiveId) {
    return null;
  }
  return payload;
};
