import { getRequestCookie } from "@/server/lib/requestCookies";

type TopicTokenCookieInput = {
  topicId?: string | null;
  topicName?: string | null;
};

const normalizeTokenCookiePart = (value?: string | null) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getTopicTokenCookieNames = ({
  topicId,
  topicName,
}: TopicTokenCookieInput) => {
  const names: string[] = [];
  const normalizedName = normalizeTokenCookiePart(topicName);
  const normalizedId = normalizeTokenCookiePart(topicId);

  if (normalizedName) {
    names.push(`t_${normalizedName}`);
  }
  if (normalizedId) {
    const idCookie = `t_${normalizedId}`;
    if (!names.includes(idCookie)) {
      names.push(idCookie);
    }
  }

  return names;
};

export const resolveTopicTokenFromRequest = ({
  request,
  topicId,
  topicName,
}: TopicTokenCookieInput & { request: Request }) => {
  const resolved = resolveTopicTokenCookieFromRequest({
    request,
    topicId,
    topicName,
  });
  return resolved?.value;
};

export const resolveTopicTokenCookieFromRequest = ({
  request,
  topicId,
  topicName,
}: TopicTokenCookieInput & { request: Request }) => {
  const cookieNames = getTopicTokenCookieNames({ topicId, topicName });
  for (const cookieName of cookieNames) {
    const value = getRequestCookie(request, cookieName);
    if (value) {
      return { name: cookieName, value };
    }
  }
  return undefined;
};
