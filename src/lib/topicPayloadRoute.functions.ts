import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { loadTopicPayloadServer } from "./topicPayloadRoute.server";

export const loadTopicPayload = createServerFn({ method: "GET" })
  .inputValidator((value: { action?: string; topicName?: string }) => value)
  .handler(async ({ data, context }) =>
    loadTopicPayloadServer({
      action: data.action?.trim() ?? "",
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    }),
  );
