import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start/server-only", () => ({}));

import { hasPerspectiveCollaborationGrant } from "@/lib/perspectiveCollaborationGrant.server";
import {
  createReflectionAccessToken,
  createReflectionWriteToken,
  getReflectionWriteCookieName,
} from "@/lib/reflectionAccess";

const PERSPECTIVE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PERSPECTIVE_ID = "22222222-2222-4222-8222-222222222222";
const ORIGINAL_SECRET = process.env.REFLECTION_ACCESS_SECRET;

afterEach(() => {
  process.env.REFLECTION_ACCESS_SECRET = ORIGINAL_SECRET;
});

describe("perspective collaboration grants", () => {
  it("requires matching read and write cookies for the exact perspective", () => {
    process.env.REFLECTION_ACCESS_SECRET = "collaboration-test-secret";
    const access = createReflectionAccessToken(PERSPECTIVE_ID);
    const write = createReflectionWriteToken(PERSPECTIVE_ID);
    const request = new Request("https://pxl8.ing/p/test/join", {
      headers: {
        cookie: `p_${PERSPECTIVE_ID}=${access}; ${getReflectionWriteCookieName(PERSPECTIVE_ID)}=${write}`,
      },
    });

    expect(
      hasPerspectiveCollaborationGrant({
        request,
        perspectiveId: PERSPECTIVE_ID,
      }),
    ).toBe(true);
    expect(
      hasPerspectiveCollaborationGrant({
        request,
        perspectiveId: OTHER_PERSPECTIVE_ID,
      }),
    ).toBe(false);
  });

  it("rejects a grant when either signed cookie is missing", () => {
    process.env.REFLECTION_ACCESS_SECRET = "collaboration-test-secret";
    const request = new Request("https://pxl8.ing/p/test/join", {
      headers: {
        cookie: `p_${PERSPECTIVE_ID}=${createReflectionAccessToken(PERSPECTIVE_ID)}`,
      },
    });

    expect(
      hasPerspectiveCollaborationGrant({
        request,
        perspectiveId: PERSPECTIVE_ID,
      }),
    ).toBe(false);
  });
});
