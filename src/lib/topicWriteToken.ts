import { resolveTopicTokenFromRequest } from "@/lib/topicTokenCookies";

export const TOPIC_LOCKED_RESPONSE = {
  code: "TOPIC_LOCKED",
  error: "Topic is locked",
} as const;

export const isTopicLockedMessage = (message?: string) =>
  message === "Invalid token";

export const resolveTopicWriteToken = ({
  request,
  topicName,
  topicId,
  bodyToken,
}: {
  request: Request;
  topicName?: string | null;
  topicId?: string | null;
  bodyToken?: string | null;
}) => {
  const inlineToken = typeof bodyToken === "string" ? bodyToken.trim() : "";
  if (inlineToken) {
    return inlineToken;
  }

  return resolveTopicTokenFromRequest({
    request,
    topicName,
    topicId,
  });
};
