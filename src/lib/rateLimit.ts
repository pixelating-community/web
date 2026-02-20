type RateLimitEntry = {
  count: number;
  reset: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const store = new Map<string, RateLimitEntry>();
const MAX_ENTRIES = 5000;

const pruneIfNeeded = (now: number) => {
  if (store.size <= MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.reset <= now) {
      store.delete(key);
    }
  }
};

export const getClientIp = (headers: Headers): string => {
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
};

export const rateLimit = (
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult => {
  const now = Date.now();
  pruneIfNeeded(now);
  const existing = store.get(key);

  if (!existing || existing.reset <= now) {
    const reset = now + windowMs;
    store.set(key, { count: 1, reset });
    return { ok: true, limit, remaining: limit - 1, reset };
  }

  existing.count += 1;
  store.set(key, existing);

  const remaining = Math.max(0, limit - existing.count);
  return {
    ok: existing.count <= limit,
    limit,
    remaining,
    reset: existing.reset,
  };
};

export const rateLimitHeaders = (result: RateLimitResult): Headers => {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(result.reset / 1000)));
  if (!result.ok) {
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    headers.set("Retry-After", String(retryAfterSeconds));
  }
  return headers;
};
