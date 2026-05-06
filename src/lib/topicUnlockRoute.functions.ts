import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const loadUnlockTopic = createServerFn({ method: "GET" })
  .inputValidator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }) => {
    const { resolveUnlockLoaderDataServer } = await import(
      "@/lib/topicUnlockRoute.server"
    );
    return resolveUnlockLoaderDataServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    });
  });
