import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTopicUnlockHref } from "@/lib/topicRoutes";
import { getTopicTokenCookieNames } from "@/lib/topicTokenCookies";
import { resolveTopicWriteToken } from "@/lib/topicWriteToken";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));

const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("topic unlock/write auth flow", () => {
  it("builds ul href and resolves write token from topic-id cookie fallback", () => {
    const topicId = "f0b8be17-5be9-44e4-8ac0-d11fa0123456";
    const originalTopicName = "art";
    const renamedTopicName = "art-renamed";
    const token = "tan4Mg8P";

    const cookieNames = getTopicTokenCookieNames({
      topicId,
      topicName: originalTopicName,
    });
    const nextPath = `/t/${renamedTopicName}`;
    const unlockHref = buildTopicUnlockHref({
      topicName: renamedTopicName,
      nextPath,
    });

    expect(unlockHref).toBe(
      `/t/${renamedTopicName}/ul?next=${encodeURIComponent(nextPath)}`,
    );

    const request = new Request(`http://localhost:3000${nextPath}`, {
      headers: {
        cookie: `${cookieNames[1]}=${token}; x=y`,
      },
    });

    expect(
      resolveTopicWriteToken({
        request,
        topicName: renamedTopicName,
        topicId,
      }),
    ).toBe(token);
  });

  it("uses document navigation after unlock so the fresh cookie is present on the next request", () => {
    const routeSource = readSource("src/routes/t.$topic.ul.tsx");
    const tokenSource = readSource("src/components/Token.tsx");
    const loginFunctionSource = readSource("src/lib/topicTokenLogin.functions.ts");

    expect(routeSource).toMatch(/throw redirect\(\{/);
    expect(routeSource).not.toMatch(/fetch\(`\/api\/t\//);
    expect(routeSource).not.toMatch(/window\.location\.replace\(nextPath\)/);
    expect(tokenSource).toMatch(/useServerFn\(saveTopicTokenAndRedirect\)/);
    expect(tokenSource).toMatch(/window\.location\.assign\(/);
    expect(loginFunctionSource).not.toMatch(/throw redirect\(\{/);
  });

  it("keeps server-only topic auth code out of client route modules", () => {
    const topicRouteSource = readSource("src/routes/t.$.tsx");
    const unlockRouteSource = readSource("src/routes/t.$topic.ul.tsx");
    const tokenComponentSource = readSource("src/components/Token.tsx");
    const topicPayloadFunctionsSource = readSource(
      "src/lib/topicPayloadRoute.functions.ts",
    );
    const topicUnlockFunctionsSource = readSource(
      "src/lib/topicUnlockRoute.functions.ts",
    );

    expect(topicRouteSource).not.toMatch(/@\/server\/actions\/getTopicPayload/);
    expect(unlockRouteSource).not.toMatch(/@\/server\/actions\/getTopic/);
    expect(unlockRouteSource).not.toMatch(/@\/server\/actions\/isLocked/);
    expect(unlockRouteSource).not.toMatch(/@\/lib\/topicToken/);
    expect(topicRouteSource).toMatch(/topicPayloadRoute\.functions/);
    expect(unlockRouteSource).toMatch(/topicUnlockRoute\.functions/);
    expect(topicPayloadFunctionsSource).not.toMatch(/createIsomorphicFn\(/);
    expect(topicUnlockFunctionsSource).not.toMatch(/createIsomorphicFn\(/);
    expect(topicPayloadFunctionsSource).not.toMatch(/currentStartRequest/);
    expect(topicUnlockFunctionsSource).not.toMatch(/currentStartRequest/);
    expect(tokenComponentSource).toMatch(/topicTokenLogin\.functions/);
    expect(tokenComponentSource).not.toMatch(/\/api\/t\/token/);
    expect(tokenComponentSource).not.toMatch(/setCookie/);
  });
});
