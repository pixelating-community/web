import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const loadChapterPayload = createServerFn({ method: "GET" })
  .validator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }) => {
    const { loadChapterPayloadServer } =
      await import("@/lib/chapterPayloadRoute.server");
    return loadChapterPayloadServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    });
  });
