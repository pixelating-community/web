import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("topic route guards", () => {
  it("keeps /t/$ read-only by default while exposing an explicit create-or-unlock write action", () => {
    const source = readSource("src/routes/t.$.tsx");
    expect(source).toMatch(
      /const shouldShowEmptyWriteSurface =\s+perspectives\.length === 0 && topic\.canWrite;/,
    );
    expect(source).toMatch(
      /const requestsNewPerspective =\s+requestedWriteId === NEW_PERSPECTIVE_QUERY_VALUE;/,
    );
    expect(source).toMatch(
      /const shouldShowWriteSurface =\s+Boolean\(resolvedRequestedWriteId\) \|\|[\s\S]*shouldShowNewWriteSurface;/,
    );
    expect(source).toMatch(/const topicWriteActionHref = topic\.canWrite/);
    expect(source).toMatch(/buildTopicNewPerspectivePath\(topic\.name\)/);
    expect(source).toMatch(/showViewerEditLink/);
    expect(source).toMatch(/viewerPlayBehavior="open-perspective-page"/);
  });

  it("keeps /t/$ editor requests on the studio SW surface with the existing prop contract", () => {
    const source = readSource("src/routes/t.$.tsx");
    expect(source).toMatch(/if \(resolvedRequestedEditorId\)/);
    expect(source).toMatch(/mode="editor"/);
    expect(source).toMatch(/showPerspectiveModeNav/);
    expect(source).toMatch(/playbackProfile: "full-file" as const/);
  });

  it("keeps dedicated listen routes on the simplified listener surface", () => {
    const source = readSource("src/routes/t.$.tsx");
    expect(source).toMatch(/else if \(resolvedRequestedViewerId\)/);
    expect(source).toMatch(/<PerspectiveListener/);
    expect(source).not.toMatch(/autoStartOnLoad/);
    expect(source).not.toMatch(/viewerPlayBehavior="inline"/);
    expect(source).not.toMatch(
      /else if \(resolvedRequestedViewerId\)[\s\S]*showViewerAudioControls/,
    );
  });

  it("keeps the dark topic background isolated to the topic shell", () => {
    const source = readSource("src/routes/t.$.tsx");
    const cssSource = readSource("src/styles/globals.css");
    const editorSource = readSource("src/components/SWEditor.tsx");
    const writeSource = readSource("src/components/WritePerspective.tsx");
    const karaokeSource = readSource("src/components/KaraokePresenter.tsx");

    expect(source).toMatch(/DARK_TOPIC_NAME = "dark"/);
    expect(source).toMatch(/DARK_TOPIC_SHELL_CLASS = `\$\{TOPIC_SHELL_CLASS\} topic-dark bg-black text-white`/);
    expect(source).toMatch(
      /getTopicShellClassName\(\s*topic\?\.name \?\? requestedTopicName,\s*\)/,
    );
    expect(cssSource).toMatch(/\.topic-dark \.sw-perspective-text/);
    expect(cssSource).toMatch(/@apply bg-linear-to-r\/oklch from-purple-500 to-pink-500 bg-clip-text text-transparent/);
    expect(cssSource).toMatch(/caret-color: var\(--color-neon-magenta\)/);
    expect(editorSource).toMatch(/sw-perspective-text/);
    expect(writeSource).toMatch(/sw-perspective-text/);
    expect(karaokeSource).toMatch(/karaoke-lines sw-perspective-text/);
    expect(source).not.toMatch(/topic\.name === "dark"/);
  });

  it("requires write access for karaoke editor routes", () => {
    const topicRoute = readSource("src/routes/t.$.tsx");
    const unlockRoute = readSource("src/routes/t.$topic.ul.tsx");

    expect(topicRoute).toMatch(
      /wantsWriteAccess: mode === "r" \|\| mode === "w" \|\| mode === "ke"/,
    );
    expect(unlockRoute).toMatch(
      /nextAction === "w" \|\| nextAction === "r" \|\| nextAction === "ke"/,
    );
  });
});
