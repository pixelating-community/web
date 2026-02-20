import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("audio click handler", () => {
  it("keeps a single play-toggle path for the custom viewer button", () => {
    const source = readSource("src/components/Audio.tsx");
    const handleClickMatch = source.match(
      /const handleClick = \(\) => \{([\s\S]*?)\n\s*\};/,
    );

    expect(handleClickMatch?.[1]).toContain("togglePlayPause();");
    expect(handleClickMatch?.[1]).not.toMatch(
      /audioRef\.current\.play\(\)\.catch/,
    );
  });

  it("does not render autoplay or playsinline on the hidden audio element", () => {
    const source = readSource("src/components/Audio.tsx");
    expect(source).not.toMatch(/\bautoPlay=\{/);
    expect(source).not.toMatch(/\bplaysInline\b/);
  });

  it("derives playing state from actual playback instead of optimistic paused checks", () => {
    const source = readSource("src/components/Audio.tsx");
    expect(source).toMatch(/audio\.addEventListener\("playing", handlePlaying\);/);
    expect(source).not.toMatch(/audio\.addEventListener\("play", handlePlay\);/);
    expect(source).not.toMatch(/setIsPlaying\(playing\);/);
  });

  it("ignores immediate duplicate pause toggles right after a play request", () => {
    const source = readSource("src/components/Audio.tsx");
    expect(source).toMatch(/lastPlayRequestAtRef/);
    expect(source).toMatch(/now - lastPlayRequestAtRef\.current < 500/);
    expect(source).toMatch(/audio\.currentTime < 0\.25/);
  });

  it("does not force-pause during the initial play-intent grace window", () => {
    const source = readSource("src/components/Audio.tsx");
    expect(source).toMatch(/playIntentUntilRef/);
    expect(source).toMatch(/performance\.now\(\) < playIntentUntilRef\.current/);
  });

  it("rewinds to the beginning before replaying an ended clip", () => {
    const source = readSource("src/components/Audio.tsx");
    expect(source).toMatch(/audio\.ended/);
    expect(source).toMatch(/audio\.currentTime = 0/);
  });

  it("uses pointerdown and suppresses the synthetic follow-up click", () => {
    const source = readSource("src/components/Audio.tsx");
    expect(source).toMatch(/lastPointerToggleAtRef/);
    expect(source).toMatch(/onPointerDown=\{handlePointerDown\}/);
    expect(source).toMatch(/now - lastPointerToggleAtRef\.current < 750/);
  });
});
