import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { SW } from "@/components/SW";
import { WritePerspective } from "@/components/WritePerspective";
import {
  buildTopicPath,
  buildTopicPerspectivePath,
  buildTopicUnlockHref,
} from "@/lib/topicRoutes";
import type { TopicPayload } from "@/types/topic";

type TopicRouteLoaderData = {
  topicName: string;
  action: string;
  data: null;
  error: string;
};

const parseTopicSegments = (splat: string | undefined) => {
  const slug = splat ?? "";
  const [topicName = "", action = ""] = slug.split("/").filter(Boolean);
  return { topicName, action };
};

const getWildcardParam = (params: Record<string, unknown>) => {
  const splat = params._splat;
  if (typeof splat === "string") return splat;
  const underscore = params._;
  if (typeof underscore === "string") return underscore;
  return undefined;
};

const getTopicQueryKey = (topicName: string, action: string) =>
  ["topic-payload", topicName, action] as const;

const fetchTopicPayload = async ({
  topicName,
  action,
}: {
  topicName: string;
  action: string;
}) => {
  const actionQuery = action ? `?action=${encodeURIComponent(action)}` : "";
  const response = await fetch(
    `/api/t/${encodeURIComponent(topicName)}${actionQuery}`,
    {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Failed to load topic");
  }
  return payload as TopicPayload;
};

export const Route = createFileRoute("/t/$")({
  loader: async ({ params }): Promise<TopicRouteLoaderData> => {
    const { topicName, action } = parseTopicSegments(
      getWildcardParam(params as Record<string, unknown>),
    );

    if (!topicName) {
      return { topicName, action, data: null, error: "" };
    }

    if (action === "f") {
      throw redirect({
        href: buildTopicPath(topicName, ""),
        replace: true,
      });
    }

    return {
      topicName,
      action,
      data: null,
      error: "",
    };
  },
  pendingComponent: TopicPending,
  component: TopicRoute,
});

function TopicPending() {
  return (
    <main className="flex flex-col items-center h-dvh">
      <div className="flex flex-col flex-1">
        <div className="text-sm text-white/80" aria-live="polite">
          🚚...
        </div>
      </div>
    </main>
  );
}

function TopicRoute() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch() as { p?: string };
  const {
    action,
    data: initialData,
    error: initialError,
    topicName: requestedTopicName,
  } = loaderData;
  const normalizedAction = action === "sw" ? "w" : action;

  const queryKey = useMemo(
    () => getTopicQueryKey(requestedTopicName, normalizedAction),
    [normalizedAction, requestedTopicName],
  );

  const topicQuery = useQuery({
    queryKey,
    queryFn: () =>
      fetchTopicPayload({
        topicName: requestedTopicName,
        action: normalizedAction,
      }),
    enabled: Boolean(requestedTopicName),
    initialData: initialData ?? undefined,
    retry: false,
  });

  const resolvedData = topicQuery.data ?? initialData;
  const resolvedError =
    topicQuery.error instanceof Error ? topicQuery.error.message : initialError;
  const topic = resolvedData?.topic;
  const requestedPath = useMemo(() => {
    const basePath = buildTopicPath(
      topic?.name ?? requestedTopicName,
      normalizedAction,
    );
    const perspectiveId = search.p?.trim();
    if (!perspectiveId) return basePath;
    const params = new URLSearchParams();
    params.set("p", perspectiveId);
    return `${basePath}?${params.toString()}`;
  }, [normalizedAction, requestedTopicName, search.p, topic?.name]);

  useEffect(() => {
    if (action !== "sw") return;
    window.location.replace(requestedPath);
  }, [action, requestedPath]);

  const isWriteAction = normalizedAction === "w";
  const shouldRedirectToUnlock = Boolean(
    topic?.id &&
    !topicQuery.isFetching &&
    (isWriteAction ? !topic.canWrite : topic.locked && !topic.canAccess),
  );

  const unlockHref = useMemo(() => {
    if (!shouldRedirectToUnlock || !topic?.name) return "";
    return buildTopicUnlockHref({
      topicName: topic.name,
      nextPath: requestedPath,
    });
  }, [requestedPath, shouldRedirectToUnlock, topic?.name]);

  useEffect(() => {
    if (!unlockHref) return;
    window.location.replace(unlockHref);
  }, [unlockHref]);

  const refreshTopicPayload = async () => {
    await topicQuery.refetch();
  };

  const isNotFound = resolvedError.trim().toLowerCase() === "topic not found";

  let content: ReactNode = (
    <div className="text-sm text-white/80" aria-live="polite">
      🚚...
    </div>
  );

  if (isNotFound) {
    content = <NotFoundPage />;
  } else if (resolvedError) {
    content = <div className="text-sm text-red-200">{resolvedError}</div>;
  } else if (shouldRedirectToUnlock) {
    content = (
      <div className="text-sm text-white/70" aria-live="polite">
        redirecting...
      </div>
    );
  } else if (topic?.id && resolvedData) {
    const { perspectives, link } = resolvedData;
    const requestedId = typeof search.p === "string" ? search.p : undefined;
    const resolvedRequestedId = requestedId
      ? perspectives.find(
          (p: TopicPayload["perspectives"][number]) => p.id === requestedId,
        )?.id
      : undefined;
    const firstAudioId = perspectives.find(
      (p: TopicPayload["perspectives"][number]) => p.audio_src,
    )?.id;
    const swEditorPerspectives =
      isWriteAction && resolvedRequestedId
        ? perspectives.filter(
            (p: TopicPayload["perspectives"][number]) =>
              p.id === resolvedRequestedId,
          )
        : perspectives;
    const initialId =
      resolvedRequestedId ?? firstAudioId ?? perspectives[0]?.id ?? "";

    const sharedSwProps = {
      perspectives: swEditorPerspectives,
      initialId,
      scrollToId: resolvedRequestedId,
      topicId: topic.id,
      playbackProfile: "full-file" as const,
    };

    if (normalizedAction === "w") {
      if (resolvedRequestedId) {
        content = (
          <SW
            key={`editor-${resolvedRequestedId}`}
            {...sharedSwProps}
            mode="editor"
          />
        );
      } else {
        content = (
          <WritePerspective
            id={topic.id}
            name={topic.name}
            perspectives={perspectives}
            forward
            link={link}
            swPerspectiveHrefBuilder={(perspective) =>
              buildTopicPerspectivePath({
                topicName: topic.name,
                perspectiveId: perspective.id,
              })
            }
            queryKey={queryKey}
            onRefresh={refreshTopicPayload}
          />
        );
      }
    } else if (normalizedAction === "") {
      content = (
        <SW
          {...sharedSwProps}
          mode="viewer"
          viewerPlayBehavior="open-perspective-page"
        />
      );
    } else {
      content = <NotFoundPage />;
    }
  }

  return (
    <main className="flex flex-col items-center h-dvh">
      <div className="flex flex-col flex-1">{content}</div>
    </main>
  );
}
