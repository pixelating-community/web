import "@tanstack/react-start/server-only";
import { getTopicPayload } from "@/server/actions/getTopicPayload";
import type { TopicPayload } from "@/types/topic";

export type TopicRouteLoaderResult = {
  data: TopicPayload | null;
  error: string;
};

export const loadTopicPayloadServer = ({
  action,
  request,
  topicName,
}: {
  action: string;
  request?: Request;
  topicName: string;
}): Promise<TopicRouteLoaderResult> =>
  getTopicPayload({
    action,
    request,
    topicName,
  });
