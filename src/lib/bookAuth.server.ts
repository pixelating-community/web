import "@tanstack/react-start/server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env.server";

const COOKIE = "book_author";
const MAX_AGE = 12 * 60 * 60;
const keys = () => {
  const dedicated = getServerEnv("BOOK_AUTHOR_KEY");
  return dedicated
    ? [dedicated]
    : [getServerEnv("EL_KEY"), getServerEnv("TS_KEY")].filter(
        (key): key is string => Boolean(key),
      );
};
const equal = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
const sign = (expires: string, key: string) =>
  createHmac("sha256", key)
    .update(`book-author:${expires}`)
    .digest("base64url");

export const hasBookAuthorKey = () => keys().length > 0;
export const verifyBookAuthorKey = (key: string) =>
  keys().some((expected) => equal(key, expected));
export const buildBookAuthorCookie = (logout = false, now = Date.now()) => {
  const key = keys()[0];
  if (!logout && !key)
    throw new Error("An author key must be configured first.");
  const expires = String(now + MAX_AGE * 1000);
  const value = logout ? "" : `${expires}.${sign(expires, key)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${logout ? 0 : MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
};
export const isBookAuthor = (request: Request, now = Date.now()) => {
  const cookie = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  const value = cookie?.slice(COOKIE.length + 1) ?? "";
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [expires, signature] = parts;
  const expiry = Number(expires);
  if (
    !Number.isSafeInteger(expiry) ||
    expiry <= now ||
    expiry > now + MAX_AGE * 1000
  )
    return false;
  return keys().some((key) => equal(signature, sign(expires, key)));
};
export const requireBookAuthor = (request: Request) => {
  if (!isBookAuthor(request))
    throw new Error("Sign in to the author area first.");
};
