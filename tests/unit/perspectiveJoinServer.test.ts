import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPerspectiveMock, hasGrantMock, issueActionTokenMock, sqlMock } =
  vi.hoisted(() => ({
    getPerspectiveMock: vi.fn<() => unknown>(),
    hasGrantMock: vi.fn<() => boolean>(),
    issueActionTokenMock: vi.fn<() => string | null>(),
    sqlMock: vi.fn<() => unknown>(),
  }));

vi.mock("@tanstack/react-start/server-only", () => ({}));
vi.mock("@/lib/actionToken.server", () => ({
  issueActionToken: issueActionTokenMock,
}));
vi.mock("@/lib/db.server", () => ({ sql: sqlMock }));
vi.mock("@/lib/getPerspectiveById.server", () => ({
  getPerspectiveById: getPerspectiveMock,
}));
vi.mock("@/lib/perspectiveCollaborationGrant.server", () => ({
  hasPerspectiveCollaborationGrant: hasGrantMock,
}));
vi.mock("@/lib/requestId", () => ({ getRequestId: () => "req-join" }));

import { loadPerspectiveJoinServer } from "@/lib/perspectiveJoin.server";

const TOPIC_ID = "11111111-1111-4111-8111-111111111111";
const PERSPECTIVE_ID = "22222222-2222-4222-8222-222222222222";
const request = new Request(`https://pxl8.ing/p/${PERSPECTIVE_ID}/join`);

describe("perspective join context", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([
      {
        emoji: "🦌",
        id: TOPIC_ID,
        locked: false,
        name: "startsw",
        short_title: "Start",
      },
    ]);
    getPerspectiveMock.mockReset();
    getPerspectiveMock.mockResolvedValue({
      id: PERSPECTIVE_ID,
      perspective: "Shared idea",
      topic_id: TOPIC_ID,
    });
    hasGrantMock.mockReset();
    hasGrantMock.mockReturnValue(false);
    issueActionTokenMock.mockReset();
    issueActionTokenMock.mockReturnValue("restricted-action-token");
  });

  it("shows a public perspective without granting contribution access", async () => {
    const result = await loadPerspectiveJoinServer({
      perspectiveId: PERSPECTIVE_ID,
      request,
    });

    expect(result.data).toMatchObject({
      canContribute: false,
      topicId: TOPIC_ID,
      topicName: "startsw",
    });
    expect(issueActionTokenMock).not.toHaveBeenCalled();
  });

  it("issues an add-only token bound to the shared parent after redemption", async () => {
    hasGrantMock.mockReturnValue(true);
    const result = await loadPerspectiveJoinServer({
      perspectiveId: PERSPECTIVE_ID,
      request,
    });

    expect(issueActionTokenMock).toHaveBeenCalledWith({
      scopes: ["perspective:add"],
      topicId: TOPIC_ID,
      perspectiveId: PERSPECTIVE_ID,
      requestId: "req-join",
    });
    expect(result.data).toMatchObject({
      actionToken: "restricted-action-token",
      canContribute: true,
    });
  });

  it("does not expose private topic content through an invite", async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: TOPIC_ID,
        locked: true,
        name: "private",
      },
    ]);
    const result = await loadPerspectiveJoinServer({
      perspectiveId: PERSPECTIVE_ID,
      request,
    });

    expect(result).toEqual({
      data: null,
      error: "Collaboration invites are unavailable for private topics.",
    });
    expect(getPerspectiveMock).not.toHaveBeenCalled();
  });
});
