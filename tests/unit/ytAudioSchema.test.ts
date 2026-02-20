import { describe, expect, it } from "vitest";

const YOUTUBE_URL_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)/;

describe("youtubeAudioSchema URL validation", () => {
  it("accepts standard youtube.com watch URL", () => {
    expect(
      YOUTUBE_URL_PATTERN.test("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe(true);
  });

  it("accepts youtube.com without www", () => {
    expect(
      YOUTUBE_URL_PATTERN.test("https://youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe(true);
  });

  it("accepts youtu.be short URL", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("accepts music.youtube.com URL", () => {
    expect(
      YOUTUBE_URL_PATTERN.test(
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
      ),
    ).toBe(true);
  });

  it("accepts http URLs", () => {
    expect(
      YOUTUBE_URL_PATTERN.test("http://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe(true);
  });

  it("rejects non-YouTube URLs", () => {
    expect(YOUTUBE_URL_PATTERN.test("https://example.com/video")).toBe(false);
  });

  it("rejects YouTube playlist URLs without watch", () => {
    expect(
      YOUTUBE_URL_PATTERN.test(
        "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
      ),
    ).toBe(false);
  });

  it("rejects empty string", () => {
    expect(YOUTUBE_URL_PATTERN.test("")).toBe(false);
  });
});
