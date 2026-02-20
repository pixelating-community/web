import { afterEach, describe, expect, it } from "vitest";
import { resolveStoredAudioSrc } from "@/lib/publicAudioBase";

const originalViteObjBaseUrl = process.env.VITE_OBJ_BASE_URL;

afterEach(() => {
  if (originalViteObjBaseUrl === undefined) {
    delete process.env.VITE_OBJ_BASE_URL;
  } else {
    process.env.VITE_OBJ_BASE_URL = originalViteObjBaseUrl;
  }
});

describe("resolveStoredAudioSrc", () => {
  it("returns null for empty values", () => {
    expect(resolveStoredAudioSrc(undefined)).toBeNull();
    expect(resolveStoredAudioSrc(null)).toBeNull();
    expect(resolveStoredAudioSrc("")).toBeNull();
    expect(resolveStoredAudioSrc("null")).toBeNull();
  });

  it("does not resolve legacy /api/obj/object URLs", () => {
    delete process.env.VITE_OBJ_BASE_URL;
    const result = resolveStoredAudioSrc(
      "/api/obj/object?key=folder%2Fclip.wav",
    );
    expect(result).toBeNull();
  });

  it("keeps /api/obj URLs as /api/obj server URLs", () => {
    delete process.env.VITE_OBJ_BASE_URL;
    const result = resolveStoredAudioSrc("/api/obj?key=folder%2Fclip.wav");
    expect(result).toBe("/api/obj?key=folder%2Fclip.wav");
  });

  it("passes through absolute URLs without vendor-specific conversion", () => {
    expect(
      resolveStoredAudioSrc("https://cdn.example.com/folder/clip.wav"),
    ).toBe("https://cdn.example.com/folder/clip.wav");
    expect(
      resolveStoredAudioSrc("http://cdn.example.com/folder/clip.wav"),
    ).toBe("http://cdn.example.com/folder/clip.wav");
  });

  it("passes through local absolute paths", () => {
    expect(resolveStoredAudioSrc("/audio/clip.wav")).toBe("/audio/clip.wav");
  });

  it("does not resolve non-portable legacy API paths", () => {
    expect(
      resolveStoredAudioSrc("/api/r2/object?key=folder%2Fclip.wav"),
    ).toBeNull();
  });

  it("resolves raw object keys to /api/obj", () => {
    delete process.env.VITE_OBJ_BASE_URL;

    expect(resolveStoredAudioSrc("folder/clip.wav")).toBe(
      "/api/obj?key=folder%2Fclip.wav",
    );
  });

  it("normalizes legacy R2 S3 absolute URLs to key-based playback URLs", () => {
    delete process.env.VITE_OBJ_BASE_URL;
    const legacyUrl =
      "https://acc123.r2.cloudflarestorage.com/wav/folder/clip.wav?X-Amz-Signature=abc";
    expect(resolveStoredAudioSrc(legacyUrl)).toBe(
      "/api/obj?key=folder%2Fclip.wav",
    );
  });

  it("normalizes legacy R2 S3 absolute URLs to custom domain URLs when configured", () => {
    process.env.VITE_OBJ_BASE_URL = "https://obj.pixelat.ing";
    const legacyUrl =
      "https://acc123.r2.cloudflarestorage.com/wav/folder/clip.wav?X-Amz-Signature=abc";
    expect(resolveStoredAudioSrc(legacyUrl)).toBe(
      "https://obj.pixelat.ing/folder/clip.wav",
    );
  });
});
