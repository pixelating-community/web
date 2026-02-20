import * as z from "zod/v4";

const decodeURIComponentSafe = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const sanitizeCommitReturnPath = (
  value: string,
  fallbackPath: string,
) => {
  const raw = value.trim();
  if (!raw) return fallbackPath;
  if (!raw.startsWith("/")) return fallbackPath;
  if (raw.startsWith("//")) return fallbackPath;
  if (!raw.startsWith("/t/") && !raw.startsWith("/p/")) return fallbackPath;
  return raw;
};

export const appendSavedSearchParam = (path: string) => {
  try {
    const url = new URL(path, "https://local.pixelating");
    url.searchParams.set("saved", "1");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return path;
  }
};

export const normalizeCommitModeSearchParam = (value: unknown) => {
  if (value === 1) return "1";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "1" || trimmed === "s") return trimmed;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === 1 || parsed === "1") return "1";
      if (parsed === "s") return "s";
    } catch {
      // Keep original value and let schema validation reject it.
    }
  }
  return value;
};

export const commitSearchSchema = z.object({
  m: z.preprocess(
    normalizeCommitModeSearchParam,
    z.enum(["1", "s"]).optional(),
  ),
  r: z.string().optional(),
  return: z.string().optional(),
});

export const parseCommitReturnPath = ({
  fallbackPath,
  rawReturn,
}: {
  fallbackPath: string;
  rawReturn?: string;
}) => sanitizeCommitReturnPath(decodeURIComponentSafe(rawReturn ?? ""), fallbackPath);
