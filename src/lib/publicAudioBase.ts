import { getPublicEnv } from "@/lib/env";

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
};

const isR2S3ApiHost = (hostname: string) =>
  hostname.toLowerCase().endsWith(".r2.cloudflarestorage.com");

const isR2S3ApiEndpoint = (value: string) => {
  try {
    const url = new URL(value);
    return isR2S3ApiHost(url.hostname);
  } catch {
    return false;
  }
};

const joinUrl = (base: string, key: string) =>
  `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
const OBJECT_PROXY_PATH = "/api/obj";
const buildProxyAudioUrl = (key: string) =>
  `${OBJECT_PROXY_PATH}?key=${encodeURIComponent(key)}`;

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeStoredAudioValue = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") {
    return null;
  }
  return trimmed;
};

export const getPublicAudioBaseUrl = () => {
  const raw = getPublicEnv("VITE_OBJ_BASE_URL") ?? "";
  const base = normalizeBaseUrl(raw);
  if (!base) return "";
  // cloudflarestorage.com is an S3 API endpoint, not a public playback domain.
  if (isR2S3ApiEndpoint(base)) return "";
  return base;
};

export const getServerAudioBaseUrl = () => {
  return getPublicAudioBaseUrl();
};

const isAbsoluteOrLocal = (value: string) =>
  value.startsWith("blob:") ||
  value.startsWith("data:") ||
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("/");

const buildAudioUrl = (key: string, base: string) => {
  if (isAbsoluteOrLocal(key)) return key;
  if (!base) return buildProxyAudioUrl(key);
  return joinUrl(base, key);
};

export const buildServerAudioUrl = (key: string) => {
  const base = getServerAudioBaseUrl();
  return buildAudioUrl(key, base);
};

export const buildPublicAudioUrl = (key: string) => {
  const base = getPublicAudioBaseUrl();
  return buildAudioUrl(key, base);
};

const keyFromApiAudioUrl = (value: string) => {
  const trimmed = value.trim();
  let key: string | null = null;
  const [pathname, query = ""] = trimmed.split("?");

  if (pathname === OBJECT_PROXY_PATH) {
    key = new URLSearchParams(query).get("key");
  } else {
    try {
      const url = new URL(trimmed);
      if (url.pathname !== OBJECT_PROXY_PATH) {
        return null;
      }
      key = url.searchParams.get("key");
    } catch {
      return null;
    }
  }

  if (!key) return null;
  return normalizeStoredAudioValue(decodeURIComponentSafe(key));
};

const keyFromR2S3ApiAudioUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (!isR2S3ApiHost(url.hostname)) return null;

    const pathname = decodeURIComponentSafe(url.pathname).replace(/^\/+/, "");
    if (!pathname) return null;

    const pathWithoutBucket = pathname.includes("/")
      ? pathname.slice(pathname.indexOf("/") + 1)
      : pathname;
    if (!pathWithoutBucket) return null;

    return normalizeStoredAudioValue(pathWithoutBucket);
  } catch {
    return null;
  }
};

const tryBuildServerAudioUrl = (key: string) => {
  try {
    return buildServerAudioUrl(key);
  } catch {
    return null;
  }
};

export const resolveStoredAudioSrc = (value: string | null | undefined) => {
  const normalizedValue = normalizeStoredAudioValue(value);
  if (!normalizedValue) return null;

  const apiKey = keyFromApiAudioUrl(normalizedValue);
  if (apiKey) return tryBuildServerAudioUrl(apiKey);

  const r2S3ApiKey = keyFromR2S3ApiAudioUrl(normalizedValue);
  if (r2S3ApiKey) return tryBuildServerAudioUrl(r2S3ApiKey);

  if (
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://")
  ) {
    return normalizedValue;
  }
  if (normalizedValue.startsWith("/api/")) return null;
  if (normalizedValue.startsWith("/")) return normalizedValue;

  return tryBuildServerAudioUrl(normalizedValue);
};
