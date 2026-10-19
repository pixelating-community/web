import "@tanstack/react-start/server-only";
import { getChapter } from "@/lib/getChapter.server";
import {
  resolveUnlockLoaderDataServer as resolveTopicUnlock,
  type UnlockLoaderData,
} from "@/lib/topicUnlockRoute.server";

export const resolveChapterUnlockLoaderDataServer = async ({
  request,
  topicName,
}: {
  request?: Request;
  topicName: string;
}): Promise<UnlockLoaderData> => {
  const chapter = await getChapter(topicName);
  if (!chapter) {
    return {
      topicId: "",
      topicName,
      locked: false,
      canAccess: false,
      canWrite: false,
      error: "chapter not found",
    };
  }
  return resolveTopicUnlock({ request, topicName });
};
