import "@tanstack/react-start/server-only";
import { getTopicPayload } from "@/lib/getTopicPayload.server";
import type { TopicPayloadQueryResult } from "@/types/topic";

export const loadTopicPayloadServer = ({
  action,
  request,
  topicName,
}: {
  action: string;
  request?: Request;
  topicName: string;
}): Promise<TopicPayloadQueryResult> =>
  getTopicPayload({
    action,
    request,
    topicName,
  });
