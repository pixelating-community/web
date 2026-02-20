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
    expect(listenerSource).toMatch(/preload="none"/);
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
});
