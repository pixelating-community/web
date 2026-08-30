import { afterEach, describe, expect, it } from "vitest";
import {
  ENABLE_TIMING_EDITOR_ENV_KEY,
  isTimingEditorEnabled,
  parseFeatureFlag,
  shouldUseTimingEditor,
} from "@/lib/featureFlags";

const ORIGINAL_FLAG_VALUE = process.env[ENABLE_TIMING_EDITOR_ENV_KEY];

afterEach(() => {
  if (ORIGINAL_FLAG_VALUE === undefined) {
    delete process.env[ENABLE_TIMING_EDITOR_ENV_KEY];
    return;
  }
  process.env[ENABLE_TIMING_EDITOR_ENV_KEY] = ORIGINAL_FLAG_VALUE;
});

describe("feature flags", () => {
  it("keeps the timing editor disabled by default", () => {
    delete process.env[ENABLE_TIMING_EDITOR_ENV_KEY];

    expect(isTimingEditorEnabled()).toBe(false);
    expect(shouldUseTimingEditor("1")).toBe(false);
  });

  it("accepts router-normalized timing editor search values when enabled", () => {
    process.env[ENABLE_TIMING_EDITOR_ENV_KEY] = "1";

    expect(shouldUseTimingEditor("1")).toBe(true);
    expect(shouldUseTimingEditor(1)).toBe(true);
    expect(shouldUseTimingEditor('"1"')).toBe(true);
    expect(shouldUseTimingEditor("full")).toBe(false);
  });

  it("parses explicit public feature flag values", () => {
    expect(parseFeatureFlag("1")).toBe(true);
    expect(parseFeatureFlag("true")).toBe(true);
    expect(parseFeatureFlag("yes")).toBe(true);
    expect(parseFeatureFlag("0")).toBe(false);
    expect(parseFeatureFlag("false")).toBe(false);
    expect(parseFeatureFlag(undefined)).toBe(false);
  });
});
