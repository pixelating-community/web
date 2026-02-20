import "@tanstack/react-start/server-only";
import { getTopicPayload } from "@/lib/getTopicPayload.server";
import type { TopicPayloadQueryResult } from "@/types/topic";

export const loadTopicPayloadServer = ({
  request,
  topicName,
}: {
  request?: Request;
  topicName: string;
}): Promise<TopicPayloadQueryResult> =>
  getTopicPayload({
    request,
    topicName,
  });
