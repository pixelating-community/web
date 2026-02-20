import "@tanstack/react-start/server-only";
import { getRequestId } from "@/lib/requestId";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";
import {
  resolveStoredTopicToken,
  topicRequiresWriteToken,
} from "@/lib/topicWriteAccess";
import { getTopic } from "@/server/actions/getTopic";
import { isLocked } from "@/server/actions/isLocked";

export type UnlockLoaderData = {
  topicId: string;
  topicName: string;
  locked: boolean;
  canAccess: boolean;
  canWrite: boolean;
  error: string;
};

export const resolveUnlockLoaderDataServer = async ({
  request,
  topicName: requestedTopicName,
}: {
  request?: Request;
  topicName: string;
}): Promise<UnlockLoaderData> => {
  if (!requestedTopicName) {
    return {
      topicId: "",
      topicName: "",
      locked: false,
      canAccess: false,
      canWrite: false,
      error: "topic required",
    };
  }

  let requestId = "server-fn";
  try {
    const topic = await getTopic({ name: requestedTopicName });
    if (!topic?.id) {
      return {
        topicId: "",
        topicName: requestedTopicName,
        locked: false,
        canAccess: false,
        canWrite: false,
        error: "topic not found",
      };
    }

    const topicId = String(topic.id);
    const topicName = String(topic.name ?? requestedTopicName);
    const locked = Boolean(await isLocked({ id: topicId }));
    const storedTopicToken = resolveStoredTopicToken(
      typeof topic.token === "string" ? topic.token : undefined,
    );
    const requiresWriteToken = topicRequiresWriteToken({
      locked,
      storedToken: storedTopicToken,
    });
    const canWriteWithoutToken = !requiresWriteToken;

    requestId = request ? getRequestId(request) : "server-fn";

    if (!request) {
      return {
        topicId,
        topicName,
        locked,
        canAccess: !locked,
        canWrite: canWriteWithoutToken,
        error: "",
      };
    }

    const resolvedTokenCookie = resolveTopicTokenCookieFromRequest({
      request,
      topicId,
      topicName,
    });
    const cookieToken = resolvedTokenCookie?.value;
    if (!cookieToken) {
      return {
        topicId,
        topicName,
        locked,
        canAccess: !locked,
        canWrite: canWriteWithoutToken,
        error: "",
      };
    }

    const isValid = await verifyTopicToken(cookieToken, storedTopicToken);

    if (!isValid) {
      console.warn("[topic-auth] Invalid token cookie on unlock route", {
        requestId,
        topicId,
        topicName,
        cookieName: resolvedTokenCookie?.name,
      });
    }

    return {
      topicId,
      topicName,
      locked,
      canAccess: locked ? isValid : true,
      canWrite: requiresWriteToken ? isValid : true,
      error: "",
    };
  } catch (error) {
    console.error(error, {
      message: "Failed to load unlock route",
      requestId,
      topicName: requestedTopicName,
    });
    return {
      topicId: "",
      topicName: requestedTopicName,
      locked: false,
      canAccess: false,
      canWrite: false,
      error: "Failed to load topic",
    };
  }
};
