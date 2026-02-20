import { describe, expect, it } from "vitest";
import { patchTopicPayloadQueryResult } from "@/lib/topicPayloadCache";
import type { TopicPayloadQueryResult } from "@/types/topic";

describe("patchTopicPayloadQueryResult", () => {
  it("updates nested perspectives inside the wrapped topic query result", () => {
    const current: TopicPayloadQueryResult = {
      data: {
        topic: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "topic",
          locked: false,
          canAccess: true,
          canWrite: true,
        },
        perspectives: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            perspective: "before",
            topic_id: "11111111-1111-4111-8111-111111111111",
          },
        ],
      },
      error: "",
    };

    const result = patchTopicPayloadQueryResult({
      current,
      updater: (items) =>
        items.map((item) => ({ ...item, perspective: "after" })),
    });

    expect(result?.data?.perspectives).toEqual([
      {
        id: "22222222-2222-4222-8222-222222222222",
        perspective: "after",
        topic_id: "11111111-1111-4111-8111-111111111111",
      },
    ]);
    expect(result?.error).toBe("");
  });

  it("leaves non-loaded query results untouched", () => {
    const current: TopicPayloadQueryResult = {
      data: null,
      error: "topic not found",
    };

    expect(
      patchTopicPayloadQueryResult({
        current,
        updater: (items) => items,
      }),
    ).toEqual(current);
  });
});
