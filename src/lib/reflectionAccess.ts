import { createHmac, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_VERSION = "v1";
const WRITE_TOKEN_VERSION = "w1";
const MAX_AGE_MS = 36 * 60 * 60 * 1000;
const CHARGE_ID_REGEX = /^ch_[a-zA-Z0-9]+$/;

const getSecret = () => process.env.REFLECTION_ACCESS_SECRET ?? "";

const signPayload = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const createReflectionAccessToken = (
  perspectiveId: string,
  issuedAtMs = Date.now(),
) => {
  const secret = getSecret();
  if (!secret) return "";

  const payload = `${ACCESS_TOKEN_VERSION}:${perspectiveId}:${issuedAtMs}`;
  const signature = signPayload(payload, secret);
  return `${ACCESS_TOKEN_VERSION}.${issuedAtMs}.${signature}`;
};

export const verifyReflectionAccessToken = (
  token: string | undefined,
  perspectiveId: string,
) => {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const [version, issuedAtRaw, signature] = token.split(".");
  if (version !== ACCESS_TOKEN_VERSION || !issuedAtRaw || !signature) {
    return false;
  }

  const issuedAtMs = Number.parseInt(issuedAtRaw, 10);
  if (!Number.isFinite(issuedAtMs)) return false;
  if (Date.now() - issuedAtMs > MAX_AGE_MS) return false;

  const payload = `${ACCESS_TOKEN_VERSION}:${perspectiveId}:${issuedAtMs}`;
  const expected = signPayload(payload, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
};

export const getReflectionWriteCookieName = (perspectiveId: string) =>
  `p_${perspectiveId}_w`;

export const createReflectionWriteToken = (
  perspectiveId: string,
  chargeId: string,
  issuedAtMs = Date.now(),
) => {
  const secret = getSecret();
  if (!secret) return "";
  if (!CHARGE_ID_REGEX.test(chargeId)) return "";

  const payload = `${WRITE_TOKEN_VERSION}:${perspectiveId}:${chargeId}:${issuedAtMs}`;
  const signature = signPayload(payload, secret);
  return `${WRITE_TOKEN_VERSION}.${issuedAtMs}.${chargeId}.${signature}`;
};

export const verifyReflectionWriteToken = (
  token: string | undefined,
  perspectiveId: string,
) => {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;

  const [version, issuedAtRaw, chargeId, signature] = token.split(".");
  if (!issuedAtRaw || !chargeId || !signature) return null;
  if (version !== WRITE_TOKEN_VERSION) return null;
  if (!CHARGE_ID_REGEX.test(chargeId)) return null;

  const issuedAtMs = Number.parseInt(issuedAtRaw, 10);
  if (!Number.isFinite(issuedAtMs)) return null;
  if (Date.now() - issuedAtMs > MAX_AGE_MS) return null;

  const payload = `${WRITE_TOKEN_VERSION}:${perspectiveId}:${chargeId}:${issuedAtMs}`;
  const expected = signPayload(payload, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;

  return chargeId;
};
