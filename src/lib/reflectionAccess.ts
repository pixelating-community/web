import { createHmac, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_VERSION = "ra1";
const WRITE_TOKEN_VERSION = "rw1";
const SHARE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const SHARE_CODE_LENGTH = 12;

const getSecret = () => process.env.REFLECTION_ACCESS_SECRET ?? "";

const signPayload = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

const encodeRandomBase32 = (size: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let output = "";
  for (let index = 0; index < size; index += 1) {
    output += SHARE_CODE_ALPHABET[bytes[index] % SHARE_CODE_ALPHABET.length];
  }
  return output;
};

export const normalizePerspectiveShareCode = (value: string) => {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
};

export const formatPerspectiveShareCode = (value: string) =>
  normalizePerspectiveShareCode(value)
    .slice(0, SHARE_CODE_LENGTH)
    .match(/.{1,4}/g)
    ?.join("-") ?? "";

export const generatePerspectiveShareCode = () =>
  formatPerspectiveShareCode(encodeRandomBase32(SHARE_CODE_LENGTH));

export const hashPerspectiveShareCode = (value: string) => {
  const secret = getSecret();
  if (!secret) return "";
  const normalized = normalizePerspectiveShareCode(value);
  if (normalized.length !== SHARE_CODE_LENGTH) return "";
  return signPayload(`share:${normalized}`, secret);
};

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
  issuedAtMs = Date.now(),
) => {
  const secret = getSecret();
  if (!secret) return "";

  const payload = `${WRITE_TOKEN_VERSION}:${perspectiveId}:${issuedAtMs}`;
  const signature = signPayload(payload, secret);
  return `${WRITE_TOKEN_VERSION}.${issuedAtMs}.${signature}`;
};

export const verifyReflectionWriteToken = (
  token: string | undefined,
  perspectiveId: string,
) => {
  if (!token) return false;
  const secret = getSecret();
  if (!secret) return false;

  const [version, issuedAtRaw, signature] = token.split(".");
  if (!issuedAtRaw || !signature) return false;
  if (version !== WRITE_TOKEN_VERSION) return false;

  const issuedAtMs = Number.parseInt(issuedAtRaw, 10);
  if (!Number.isFinite(issuedAtMs)) return false;
  const payload = `${WRITE_TOKEN_VERSION}:${perspectiveId}:${issuedAtMs}`;
  const expected = signPayload(payload, secret);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return false;

  return true;
};
