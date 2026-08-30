import "@tanstack/react-start/server-only";
import { createHash, randomBytes } from "node:crypto";
import { getRequestCookie } from "@/server/lib/requestCookies";

export const SUPPORT_VOTER_COOKIE = "pxl8_voter";

const hashVoterToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const getVoterHashFromRequest = (request: Request) => {
  const token = getRequestCookie(request, SUPPORT_VOTER_COOKIE)?.trim();
  return token ? hashVoterToken(token) : null;
};

export const createVoterIdentity = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, voterHash: hashVoterToken(token) };
};

export const buildVoterCookie = (token: string) => {
  const parts = [
    `${SUPPORT_VOTER_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${5 * 365 * 24 * 60 * 60}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
};
