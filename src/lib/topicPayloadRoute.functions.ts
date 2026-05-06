import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const loadTopicPayload = createServerFn({ method: "GET" })
  .inputValidator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }) => {
    const { loadTopicPayloadServer } = await import(
      "@/lib/topicPayloadRoute.server"
    );
    return loadTopicPayloadServer({
      request:
        (context as { request?: Request } | undefined)?.request ?? getRequest(),
      topicName: data.topicName?.trim() ?? "",
    });
  });
