import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveUnlockLoaderDataServer } from "./topicUnlockRoute.server";

export const loadUnlockTopic = createServerFn({ method: "GET" })
  .inputValidator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }) =>
    resolveUnlockLoaderDataServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    }),
  );
