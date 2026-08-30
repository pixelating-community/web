import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("sw player compatibility", () => {
  it("does not preflight-block webm playback before play() is attempted", () => {
    const source = readSource("src/components/sw/useSwPlaybackController.ts");
    expect(source).not.toMatch(/WebM\/Opus is not playable here/);
    expect(source).toMatch(/const playPromise = audio\.play\(\);/);
  });

  it("keeps the inline viewer play button on a direct startPlayback path", () => {
    const source = readSource("src/components/sw/useSwPlaybackController.ts");
    expect(source).toMatch(/handlePlayControlActivate/);
    expect(source).toMatch(/startPlayback\(\{/);
    expect(source).not.toMatch(/togglePlayback\(\)/);
  });

  it("keeps dedicated listen routes on a tap-to-play listener path", () => {
    const swSource = readSource("src/components/sw/useSwPlaybackController.ts");
    const listenerSource = readSource("src/components/PerspectiveListener.tsx");
    const editorSource = readSource("src/components/SWEditor.tsx");
    const topicRouteSource = readSource("src/routes/t.$.tsx");
    const perspectiveRouteSource = readSource("src/routes/p.$id.tsx");

    expect(listenerSource).toMatch(/void audio\s*\.play\(\)\s*\.then/);
    expect(listenerSource).not.toMatch(/audio\.src\s*=/);
    expect(listenerSource).not.toMatch(/\bautoPlay=\{/);
    expect(listenerSource).toMatch(/isBenignPlaybackRejection/);
    expect(listenerSource).toMatch(/MEDIA_ERR_ABORTED/);
    expect(listenerSource).toMatch(/onClick=\{handleTogglePlayback\}/);
    expect(listenerSource).toMatch(/audio\.ended/);
    expect(listenerSource).toMatch(/audio\.load\(\)/);
    expect(listenerSource).toMatch(/NETWORK_EMPTY/);
    expect(listenerSource).toMatch(
      /<video[\s\S]*className=\{`h-full w-full object-cover \$\{PERSPECTIVE_BACKGROUND_MEDIA_FILTER_CLASS\}`\}[\s\S]*preload="none"/,
    );
    expect(listenerSource).not.toMatch(/\bobject-contain\b/);
    expect(listenerSource).toMatch(/<audio[\s\S]*preload="none"/);
    expect(listenerSource).not.toMatch(/\bautoPlay(?:=|\b)/);
    expect(listenerSource).not.toMatch(/hasAutoStartedRef/);
    expect(swSource).toMatch(/playIntentUntilRef/);
    expect(swSource).toMatch(/audio\.currentTime = 0/);
    expect(editorSource).toMatch(/if \(!readOnly \|\| !shouldEnableWordMode\) return;/);
    expect(editorSource).toMatch(
      /if \(!readOnly \|\| !shouldEnableWordMode \|\| !allowWordSeek\) return;/,
    );
    expect(topicRouteSource).not.toMatch(/autoStartOnLoad/);
    expect(perspectiveRouteSource).not.toMatch(/autoStartOnLoad/);
  });

  it("uses stored perspective videos as karaoke backgrounds when no override is provided", () => {
    const source = readSource("src/components/KaraokeListener.tsx");

    expect(source).toMatch(/const resolvedVideoSrc = useMemo/);
    expect(source).toMatch(
      /resolvePublicAudioSrc\(videoSrc\) \|\| resolvePublicAudioSrc\(perspective\.video_src\)/,
    );
    expect(source).toMatch(/src=\{resolvedVideoSrc\}/);
    expect(source).toMatch(/\{!resolvedVideoSrc \? \(/);
    expect(source).not.toMatch(/\{!videoSrc \? \(/);
  });

  it("keeps manual timing marks on the MIDI-style press and release path", () => {
    const footerSource = readSource("src/components/SWEFooter.tsx");
    const timingSource = readSource("src/components/sw/useSwTimingEditor.ts");

    expect(footerSource).toMatch(/onPointerDown=\{\(event\) => \{/);
    expect(footerSource).toMatch(/onMarkStart\(\);/);
    expect(footerSource).toMatch(/onPointerUp=\{\(event\) => \{/);
    expect(footerSource).toMatch(/onMarkEndAndForward\(\);/);
    expect(timingSource).toMatch(/event\.key === "ArrowRight"/);
    expect(timingSource).toMatch(/markStart\(\);/);
    expect(timingSource).toMatch(/const handleKeyUp = \(event: KeyboardEvent\) => \{/);
    expect(timingSource).toMatch(/markEndAndForward\(\);/);
  });

  it("keeps selected word start and duration controls wired to editor timing state", () => {
    const swSource = readSource("src/components/SW.tsx");
    const footerSource = readSource("src/components/SWEFooter.tsx");

    expect(swSource).toMatch(/coerceTimingEntry\(selectedTimings, selectedWordIndex\)/);
    expect(swSource).toMatch(/getTimingDuration\(selectedTimings, selectedWordIndex\)/);
    expect(swSource).toMatch(/selectedWordStart=\{selectedWordStart\}/);
    expect(swSource).toMatch(/selectedWordDuration=\{selectedWordDuration\}/);
    expect(swSource).toMatch(/onSetWordStartToCurrent=\{setWordStartToCurrent\}/);

    expect(footerSource).toMatch(/selectedWordStart/);
    expect(footerSource).toMatch(/selectedWordDuration/);
    expect(footerSource).toMatch(/onSetWordStartToCurrent/);
    expect(footerSource).toMatch(/Set selected word duration from playback position/);
  });
});
