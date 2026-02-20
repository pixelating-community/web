import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("TanStack Start auth and boundary patterns", () => {
  it("keeps collaboration code cookie writes inside a TanStack server function", () => {
    const perspectiveShareSource = readSource(
      "src/components/PerspectiveShare.tsx",
    );
    const shareFunctionsSource = readSource(
      "src/lib/perspectiveShare.functions.ts",
    );

    expect(perspectiveShareSource).toMatch(
      /useServerFn\(redeemPerspectiveShareCode\)/,
    );
    expect(perspectiveShareSource).not.toMatch(/fetch\(`/);
    expect(shareFunctionsSource).toMatch(/getResponseHeaders/);
  });

  it("keeps perspective route modules importing .functions wrappers instead of inline server code", () => {
    const perspectiveRouteSource = readSource("src/routes/p.$id.tsx");
    const commitRouteSource = readSource("src/routes/p.$id.commit.tsx");

    expect(perspectiveRouteSource).toMatch(/perspectiveRoute\.functions/);
    expect(commitRouteSource).toMatch(/perspectiveCommitRoute\.functions/);

    expect(perspectiveRouteSource).not.toMatch(/createServerFn\(/);
    expect(commitRouteSource).not.toMatch(/createServerFn\(/);

    expect(perspectiveRouteSource).not.toMatch(/@\/lib\/db/);
    expect(commitRouteSource).not.toMatch(/@\/lib\/db/);
  });

  it("keeps TanStack server-only helpers in lib .server files instead of a generic server bucket", () => {
    const topicPayloadServerSource = readSource("src/lib/topicPayloadRoute.server.ts");
    const topicUnlockServerSource = readSource("src/lib/topicUnlockRoute.server.ts");
    const perspectiveMutationServerSource = readSource(
      "src/lib/perspectiveMutation.server.ts",
    );
    const perspectiveShareServerSource = readSource(
      "src/lib/perspectiveShare.server.ts",
    );

    expect(topicPayloadServerSource).not.toMatch(/@\/server\/(actions|services)\//);
    expect(topicUnlockServerSource).not.toMatch(/@\/server\/(actions|services)\//);
    expect(perspectiveMutationServerSource).not.toMatch(
      /@\/server\/(actions|services)\//,
    );
    expect(perspectiveShareServerSource).not.toMatch(
      /@\/server\/(actions|services)\//,
    );
  });

  it("keeps remaining topic-owned mutations on TanStack server functions instead of raw same-app api fetches", () => {
    const writePerspectiveSource = readSource("src/components/WritePerspective.tsx");
    const perspectiveShareSource = readSource(
      "src/components/PerspectiveShare.tsx",
    );
    const swRecordingSource = readSource("src/components/sw/useSwRecording.ts");
    const commitRouteSource = readSource("src/routes/p.$id.commit.tsx");

    expect(writePerspectiveSource).toMatch(/useServerFn\(createPerspective\)/);
    expect(writePerspectiveSource).toMatch(/useServerFn\(updatePerspective\)/);
    expect(writePerspectiveSource).toMatch(/useServerFn\(removePerspective\)/);
    expect(writePerspectiveSource).not.toMatch(/actions\/addPerspective/);
    expect(writePerspectiveSource).not.toMatch(/actions\/editPerspective/);
    expect(writePerspectiveSource).not.toMatch(/actions\/deletePerspective/);
    expect(writePerspectiveSource).not.toMatch(/fetch\("\/api\/p/);

    expect(perspectiveShareSource).toMatch(
      /useServerFn\(loadPerspectiveShareStatus\)/,
    );
    expect(perspectiveShareSource).toMatch(
      /useServerFn\(generatePerspectiveShareCodeFn\)/,
    );
    expect(perspectiveShareSource).toMatch(
      /useServerFn\(redeemPerspectiveShareCode\)/,
    );
    expect(perspectiveShareSource).not.toMatch(/fetch\("/);

    expect(swRecordingSource).toMatch(/useServerFn\(savePerspectiveAlignment\)/);
    expect(swRecordingSource).not.toMatch(/fetch\(`\/api\/p\/\$\{id\}\/align/);
    expect(commitRouteSource).toMatch(/useServerFn\(savePerspectiveAlignment\)/);
    expect(commitRouteSource).not.toMatch(/fetch\(`\/api\/p\/\$\{id\}\/align/);
  });

  it("keeps route search parsing at the router boundary and preloads the topic query cache", () => {
    const topicRouteSource = readSource("src/routes/t.$.tsx");
    const unlockRouteSource = readSource("src/routes/t.$topic.ul.tsx");

    expect(topicRouteSource).toMatch(/validateSearch: parseTopicRouteSearch/);
    expect(topicRouteSource).toMatch(/ensureQueryData/);
    expect(topicRouteSource).toMatch(/useSuspenseQuery/);
    expect(topicRouteSource).not.toMatch(/Route\.useSearch\(\) as Record<string, unknown>/);

    expect(unlockRouteSource).toMatch(/validateSearch: parseTopicUnlockSearch/);
    expect(unlockRouteSource).not.toMatch(/new URLSearchParams\(location\.searchStr\)/);
  });
});
