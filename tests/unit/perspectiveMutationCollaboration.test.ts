import { beforeEach, describe, expect, it, vi } from "vitest";

const { addPerspectiveMock, hasGrantMock, sqlMock, verifyActionTokenMock } =
  vi.hoisted(() => ({
    addPerspectiveMock: vi.fn<() => unknown>(),
    hasGrantMock: vi.fn<() => boolean>(),
    sqlMock: vi.fn<() => unknown>(),
    verifyActionTokenMock: vi.fn<() => unknown>(),
  }));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/actionToken.server", () => ({
  verifyActionToken: verifyActionTokenMock,
}));
vi.mock("@/lib/addPerspective.server", () => ({
  addPerspective: addPerspectiveMock,
}));
vi.mock("@/lib/db.server", () => ({ sql: sqlMock }));
vi.mock("@/lib/perspectiveCollaborationGrant.server", () => ({
  hasPerspectiveCollaborationGrant: hasGrantMock,
}));
vi.mock("@/lib/requestId", () => ({ getRequestId: () => "req-collab" }));
vi.mock("@/lib/topicWriteToken", () => ({
  isTopicLockedMessage: () => false,
  resolveTopicWriteToken: () => undefined,
  TOPIC_LOCKED_RESPONSE: { code: "TOPIC_LOCKED", error: "Topic locked" },
}));

import { createPerspectiveServer } from "@/lib/perspectiveMutation.server";

const TOPIC_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PARENT_ID = "33333333-3333-4333-8333-333333333333";
const request = new Request("https://pxl8.ing/p/test/join");

const data = {
  actionToken: "restricted-action-token",
  perspective: "A collaborative reflection",
  topicId: TOPIC_ID,
  topicName: "startsw",
  parentPerspectiveId: PARENT_ID,
};

describe("collaboration perspective mutations", () => {
  beforeEach(() => {
    addPerspectiveMock.mockReset();
    addPerspectiveMock.mockResolvedValue({ ok: true });
    hasGrantMock.mockReset();
    hasGrantMock.mockReturnValue(true);
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([
      {
        topic_id: TOPIC_ID,
        topic_locked: false,
        topic_name: "startsw",
        topic_token: "stored-hash",
      },
    ]);
    verifyActionTokenMock.mockReset();
    verifyActionTokenMock.mockReturnValue({
      perspectiveId: PARENT_ID,
      scopes: ["perspective:add"],
      topicId: TOPIC_ID,
    });
  });

  it("allows a valid grant to add one child under its scoped parent", async () => {
    await expect(createPerspectiveServer({ request, data })).resolves.toEqual({
      ok: true,
    });

    expect(hasGrantMock).toHaveBeenCalledWith({
      request,
      perspectiveId: PARENT_ID,
    });
    expect(addPerspectiveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collaborationAuthorized: true,
        parentPerspectiveId: PARENT_ID,
        topicId: TOPIC_ID,
      }),
    );
  });

  it("rejects root writes and writes beneath another parent", async () => {
    for (const parentPerspectiveId of [undefined, OTHER_PARENT_ID]) {
      const result = await createPerspectiveServer({
        request,
        data: { ...data, parentPerspectiveId },
      });
      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_COLLABORATION_SCOPE",
      });
    }
    expect(addPerspectiveMock).not.toHaveBeenCalled();
  });

  it("rejects missing grants and private parent topics", async () => {
    hasGrantMock.mockReturnValueOnce(false);
    await expect(
      createPerspectiveServer({ request, data }),
    ).resolves.toMatchObject({
      ok: false,
      code: "INVALID_COLLABORATION_GRANT",
    });

    sqlMock.mockResolvedValueOnce([
      {
        topic_id: TOPIC_ID,
        topic_locked: true,
        topic_name: "startsw",
        topic_token: "stored-hash",
      },
    ]);
    await expect(
      createPerspectiveServer({ request, data }),
    ).resolves.toMatchObject({
      ok: false,
      code: "INVALID_COLLABORATION_GRANT",
    });
    expect(addPerspectiveMock).not.toHaveBeenCalled();
  });
});
