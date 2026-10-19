import "@tanstack/react-start/server-only";
import { getChapter } from "@/lib/getChapter.server";
import { getTopicPayload } from "@/lib/getTopicPayload.server";
import type { TopicPayloadQueryResult } from "@/types/topic";

export const loadChapterPayloadServer = async ({
  request,
  topicName,
}: {
  request?: Request;
  topicName: string;
}): Promise<TopicPayloadQueryResult> => {
  const chapter = await getChapter(topicName);
  if (!chapter) return { data: null, error: "chapter not found" };
  return getTopicPayload({ request, topicName });
};
