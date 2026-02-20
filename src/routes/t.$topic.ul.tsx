import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo } from "react";
import { Token } from "@/components/Token";
import { sql } from "@/lib/db";
import { getRequestId } from "@/lib/requestId";
import { buildTopicPath, sanitizeTopicNextPath } from "@/lib/topicRoutes";
import { verifyTopicToken } from "@/lib/topicToken";
import { resolveTopicTokenCookieFromRequest } from "@/lib/topicTokenCookies";
import { getTopic } from "@/server/actions/getTopic";
import { isLocked } from "@/server/actions/isLocked";

type UnlockLoaderData = {
  topicId: string;
  topicName: string;
  locked: boolean;
  canAccess: boolean;
  canWrite: boolean;
  error: string;
};

const loadUnlockTopic = createServerFn({ method: "GET" })
  .inputValidator((value: { topicName?: string }) => value)
  .handler(async ({ data, context }): Promise<UnlockLoaderData> => {
    const requestedTopicName = data.topicName?.trim() ?? "";

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
      const canWriteWhenUnlocked = !locked;

      const request = (context as { request?: Request } | undefined)?.request;
      requestId = request ? getRequestId(request) : "server-fn";

      if (!request) {
        return {
          topicId,
          topicName,
          locked,
          canAccess: !locked,
          canWrite: canWriteWhenUnlocked,
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
          canWrite: canWriteWhenUnlocked,
          error: "",
        };
      }

      const rows = await sql`
        SELECT token
        FROM topics
        WHERE id = ${topicId}
        LIMIT 1
      `;

      const isValid = await verifyTopicToken(
        cookieToken,
        typeof rows[0]?.token === "string" ? rows[0].token : undefined,
      );

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
        canWrite: locked ? isValid : true,
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
  });

export const Route = createFileRoute("/t/$topic/ul")({
  loader: async ({ params }) => {
    const topicName = params.topic?.trim() ?? "";
    return loadUnlockTopic({ data: { topicName } });
  },
  component: TopicUnlockRoute,
});

function TopicUnlockRoute() {
  const data = Route.useLoaderData();
  const search = Route.useSearch() as { next?: string };
  const fallbackPath = useMemo(
    () => buildTopicPath(data.topicName, "w"),
    [data.topicName],
  );
  const nextPath = useMemo(
    () =>
      sanitizeTopicNextPath({
        nextPath: search.next,
        fallbackPath,
      }),
    [fallbackPath, search.next],
  );
  const nextAction = useMemo(() => {
    const segments = nextPath.split("/").filter(Boolean);
    if (segments[0] !== "t" || segments.length < 2) return "";
    return segments[2] ?? "";
  }, [nextPath]);
  const requiresWriteToken = nextAction === "w";
  const hasAccess = requiresWriteToken ? data.canWrite : data.canAccess;

  useEffect(() => {
    if (data.error) return;
    if (hasAccess) {
      window.location.replace(nextPath);
    }
  }, [data.error, hasAccess, nextPath]);

  useEffect(() => {
    if (data.error || !data.topicName) return;
    let cancelled = false;

    const actionQuery = nextAction
      ? `?action=${encodeURIComponent(nextAction)}`
      : "";
    void fetch(`/api/t/${encodeURIComponent(data.topicName)}${actionQuery}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as {
          topic?: { canAccess?: boolean; canWrite?: boolean; locked?: boolean };
        } | null;
      })
      .then((payload) => {
        if (cancelled) return;
        const topic = payload?.topic;
        if (!topic) return;
        const canProceed = requiresWriteToken
          ? Boolean(topic.canWrite)
          : !topic.locked || Boolean(topic.canAccess);
        if (canProceed) {
          window.location.replace(nextPath);
        }
      })
      .catch(() => {
        // Keep unlock page interactive when probe request fails.
      });

    return () => {
      cancelled = true;
    };
  }, [data.error, data.topicName, nextAction, nextPath, requiresWriteToken]);

  if (data.error) {
    return (
      <main className="flex h-dvh w-full items-center justify-center px-4">
        <div className="text-sm text-red-200">{data.error}</div>
      </main>
    );
  }

  if (hasAccess) {
    return (
      <main className="flex h-dvh w-full items-center justify-center px-4">
        <div className="text-sm text-white/70" aria-live="polite">
          redirecting...
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-dvh w-full items-center justify-center px-4">
      <div className="flex w-full max-w-xl flex-col gap-4">
        <div className="text-center text-2xl">🔒</div>
        <Token
          name={data.topicName}
          topicId={data.topicId}
          onSaved={() => {
            window.location.assign(nextPath);
          }}
        />
      </div>
    </main>
  );
}
