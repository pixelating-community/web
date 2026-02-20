import { beforeEach, describe, expect, it, vi } from "vitest";

const { sqlMock, verifyActionTokenMock } = vi.hoisted(() => ({
  sqlMock: vi.fn<() => unknown>(),
  verifyActionTokenMock: vi.fn<() => unknown>(),
}));

vi.mock("@tanstack/react-start/server-only", () => ({}));

vi.mock("@/lib/actionToken.server", () => ({
  verifyActionToken: verifyActionTokenMock,
}));

vi.mock("@/lib/db.server", () => ({
  sql: sqlMock,
}));

vi.mock("@/lib/requestId", () => ({
  getRequestId: () => "req-1",
}));

import { setPerspectiveBoundsServer } from "@/lib/perspectiveBounds.server";

const request = new Request("https://we.pixelat.ing/t/art/ke/p1");

describe("setPerspectiveBoundsServer", () => {
  beforeEach(() => {
    sqlMock.mockReset();
    verifyActionTokenMock.mockReset();
    verifyActionTokenMock.mockReturnValue(true);
  });

  it("verifies the action token, updates the database, and returns a canonical bounds href", async () => {
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.topic_id")) {
          return [
            {
              end_time: null,
              start_time: null,
              topic_id: "topic-1",
              topic_name: "art tools",
            },
          ];
        }
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    const result = await setPerspectiveBoundsServer({
      request,
      data: {
        actionToken: "align-token",
        currentPath: "/t/art%20tools/ke/p1?i=img#words",
        perspectiveId: "p1",
        startTime: 1.194742,
        topicId: "topic-1",
      },
    });

    expect(verifyActionTokenMock).toHaveBeenCalledWith({
      token: "align-token",
      requiredScope: "perspective:align",
      topicId: "topic-1",
    });
    expect(updates).toEqual([[1.194742, "p1"]]);
    expect(result).toEqual({
      ok: true,
      href: "/t/art%20tools/ke/p1?i=img&s=1.194742#words",
      startTime: 1.194742,
      endTime: null,
    });
  });

  it("adds an end bound while preserving the stored start bound", async () => {
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.topic_id")) {
          return [
            {
              end_time: null,
              start_time: 1.194742,
              topic_id: "topic-1",
              topic_name: "art tools",
            },
          ];
        }
        if (query.includes("UPDATE perspectives")) {
          return [values];
        }
        return [];
      },
    );

    const result = await setPerspectiveBoundsServer({
      request,
      data: {
        actionToken: "align-token",
        currentPath: "https://evil.example/t/art/ke/p1?x=1",
        endTime: 57.719742,
        perspectiveId: "p1",
        topicId: "topic-1",
      },
    });

    expect(result).toEqual({
      ok: true,
      href: "/t/art%20tools/ke/p1?s=1.194742&e=57.719742",
      startTime: 1.194742,
      endTime: 57.719742,
    });
  });

  it("fills the missing start bound when saving an end bound first", async () => {
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.topic_id")) {
          return [
            {
              end_time: null,
              start_time: null,
              topic_id: "topic-1",
              topic_name: "art tools",
            },
          ];
        }
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    const result = await setPerspectiveBoundsServer({
      request,
      data: {
        actionToken: "align-token",
        currentPath: "/t/art%20tools/ke/p1",
        endTime: 57.719742,
        perspectiveId: "p1",
        topicId: "topic-1",
      },
    });

    expect(updates).toEqual([[0, "p1"], [57.719742, "p1"]]);
    expect(result).toEqual({
      ok: true,
      href: "/t/art%20tools/ke/p1?s=0&e=57.719742",
      startTime: 0,
      endTime: 57.719742,
    });
  });

  it("fills the missing end bound when saving a start bound with a media duration", async () => {
    const updates: unknown[][] = [];
    sqlMock.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const query = strings.join(" ");
        if (query.includes("SELECT p.topic_id")) {
          return [
            {
              end_time: null,
              start_time: null,
              topic_id: "topic-1",
              topic_name: "art tools",
            },
          ];
        }
        if (query.includes("UPDATE perspectives")) {
          updates.push(values);
          return [];
        }
        return [];
      },
    );

    const result = await setPerspectiveBoundsServer({
      request,
      data: {
        actionToken: "align-token",
        currentPath: "/t/art%20tools/ke/p1",
        defaultEndTime: 90.1234567,
        perspectiveId: "p1",
        startTime: 1.194742,
        topicId: "topic-1",
      },
    });

    expect(updates).toEqual([[1.194742, "p1"], [90.1234567, "p1"]]);
    expect(result).toEqual({
      ok: true,
      href: "/t/art%20tools/ke/p1?s=1.194742&e=90.123457",
      startTime: 1.194742,
      endTime: 90.1234567,
    });
  });
});
