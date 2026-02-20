import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { loadTopicPayloadServer } from "@/lib/topicPayloadRoute.server";

export const loadTopicPayload = createServerFn({ method: "GET" })
  .inputValidator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }) =>
    loadTopicPayloadServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    }),
  );
