import { getRequestId } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";
import {
  resolveStoredTopicToken,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";
import type { TopicPayload } from "@/types/topic";
import { getPerspectives } from "./getPerspectives";
import { getQRCode } from "./getQRCode";
import { getTopic } from "./getTopic";
import { isLocked } from "./isLocked";

export type TopicPayloadResult = {
  data: TopicPayload | null;
  error: string;
};

export const getTopicPayload = async ({
  action,
  request,
  topicName,
}: {
  action?: string;
  request?: Request;
  topicName: string;
}): Promise<TopicPayloadResult> => {
  const trimmedTopicName = topicName.trim();
  const trimmedAction = action?.trim() ?? "";
  const requestId = request ? getRequestId(request) : "server-fn";

  if (!trimmedTopicName) {
    return { data: null, error: "topic required" };
  }

  try {
    const topic = await getTopic({ name: trimmedTopicName });
    if (!topic?.id) {
      return { data: null, error: "topic not found" };
    }

    const topicId = String(topic.id);
    const canonicalTopicName = String(topic.name ?? trimmedTopicName);
    const topicEmoji =
      typeof topic.emoji === "string" ? topic.emoji.trim() : "";
    const topicShortTitle =
      typeof topic.short_title === "string" ? topic.short_title.trim() : "";
    const locked = Boolean(await isLocked({ id: topicId }));
    const storedTopicToken = resolveStoredTopicToken(
      typeof topic.token === "string" ? topic.token : undefined,
    );
    const requiresWriteToken = topicRequiresWriteToken({
      locked,
      storedToken: storedTopicToken,
    });
    const resolvedTokenCookie = request
      ? resolveTopicTokenCookieFromRequest({
          request,
          topicId,
          topicName: canonicalTopicName,
        })
      : null;
    const cookieToken = resolvedTokenCookie?.value;

    let validToken: string | undefined;
    if (cookieToken && storedTopicToken) {
      if (await verifyTopicToken(cookieToken, storedTopicToken)) {
        validToken = cookieToken;
      } else {
        console.warn("[topic-auth] Invalid token cookie on topic payload", {
          requestId,
          cookieName: resolvedTokenCookie?.name,
          topicId,
          topicName: canonicalTopicName,
        });
      }
    }

    const canWrite = requiresWriteToken ? Boolean(validToken) : true;
    const canAccess = locked ? canWrite : true;
    const perspectives =
      !locked || canAccess
        ? ((await getPerspectives({
            topicId,
            isLocked: locked,
            token: validToken,
            forward: true,
          })) as TopicPayload["perspectives"] | undefined) ?? []
        : [];
    const link = await getQRCode({
      path: `/t/${canonicalTopicName}${trimmedAction ? `/${trimmedAction}` : ""}`,
    });

    return {
      data: {
        topic: {
          id: topicId as TopicPayload["topic"]["id"],
          name: canonicalTopicName,
          shortTitle: topicShortTitle || undefined,
          emoji: topicEmoji || undefined,
          locked,
          canAccess,
          canWrite,
        },
        perspectives,
        link,
      },
      error: "",
    };
  } catch (error) {
    console.error(error, {
      message: "Failed to load topic payload",
      requestId,
      topicName: trimmedTopicName,
    });
    return { data: null, error: "Failed to load topic" };
  }
};
