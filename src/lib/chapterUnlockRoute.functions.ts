import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const loadUnlockChapter = createServerFn({ method: "GET" })
  .validator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }) => {
    const { resolveChapterUnlockLoaderDataServer } =
      await import("@/lib/chapterUnlockRoute.server");
    return resolveChapterUnlockLoaderDataServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    });
  });
