export const ENABLE_TIMING_EDITOR_ENV_KEY = "VITE_ENABLE_TIMING_EDITOR";
export const TIMING_EDITOR_SEARCH_VALUE = "1";

export const parseFeatureFlag = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const getTimingEditorFlagValue = () => {
  if (import.meta.env.MODE === "test") {
    return process.env[ENABLE_TIMING_EDITOR_ENV_KEY];
  }

  return import.meta.env.VITE_ENABLE_TIMING_EDITOR;
};

export const isTimingEditorEnabled = () =>
  parseFeatureFlag(getTimingEditorFlagValue());

const normalizeTimingEditorSearchValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!(trimmed.startsWith('"') && trimmed.endsWith('"'))) return trimmed;

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "string" && parsed.trim()
      ? parsed.trim()
      : trimmed;
  } catch {
    return trimmed;
  }
};

export const shouldUseTimingEditor = (value: unknown) =>
  isTimingEditorEnabled() &&
  normalizeTimingEditorSearchValue(value) === TIMING_EDITOR_SEARCH_VALUE;
