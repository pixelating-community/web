import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PerspectiveListener } from "@/components/PerspectiveListener";
import { SW } from "@/components/SW";
import { WritePerspective } from "@/components/WritePerspective";
import { loadTopicPayload } from "@/lib/topicPayloadRoute.functions";
import {
  buildTopicNewPerspectiveHref,
  buildTopicPath,
  buildTopicUnlockHref,
  NEW_PERSPECTIVE_QUERY_VALUE,
} from "@/lib/topicRoutes";
import { shouldRequireTopicUnlock } from "@/lib/topicWriteAccess";
import type { TopicPayload } from "@/types/topic";

type TopicRouteLoaderData = {
  topicName: string;
  action: string;
  data: TopicPayload | null;
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

const appendSearchToPath = (path: string, searchStr: string) =>
  searchStr ? `${path}${searchStr}` : path;

const wantsWriteAccess = (search: Record<string, unknown>) =>
  (typeof search.r === "string" && search.r.trim().length > 0) ||
  (typeof search.w === "string" && search.w.trim().length > 0);

export const Route = createFileRoute("/t/$")({
  loader: async ({ location, params }): Promise<TopicRouteLoaderData> => {
    const { topicName, action } = parseTopicSegments(
      getWildcardParam(params as Record<string, unknown>),
    );

    if (!topicName) {
      return { topicName, action, data: null, error: "" };
    }

    if (action === "f") {
      throw redirect({
        href: buildTopicPath(topicName),
        replace: true,
      });
    }

    const isLegacyWriteAction = action === "w" || action === "sw";
    const queryAction = isLegacyWriteAction ? "" : action;
    const result = await loadTopicPayload({
      data: {
        action: queryAction,
        topicName,
      },
    });
    const resolvedTopicName = result.data?.topic.name ?? topicName;
    const requestedPath = appendSearchToPath(
      buildTopicPath(resolvedTopicName),
      location.searchStr,
    );

    if (isLegacyWriteAction) {
      throw redirect({
        href: requestedPath,
        replace: true,
      });
    }

    if (
      result.data?.topic.id &&
      queryAction === "" &&
      shouldRequireTopicUnlock({
        locked: Boolean(result.data.topic.locked),
        canAccess: Boolean(result.data.topic.canAccess),
        canWrite: Boolean(result.data.topic.canWrite),
        wantsWriteAccess: wantsWriteAccess(
          location.search as Record<string, unknown>,
        ),
      })
    ) {
      throw redirect({
        href: buildTopicUnlockHref({
          topicName: result.data.topic.name,
          nextPath: requestedPath,
        }),
        replace: true,
      });
    }

    return {
      topicName: resolvedTopicName,
      action,
      data: result.data,
      error: result.error,
    };
  },
  pendingMs: 1500,
  preloadStaleTime: 30_000,
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
  const loadTopicPayloadFn = useServerFn(loadTopicPayload);
  const search = Route.useSearch() as Record<string, unknown>;
  const {
    action,
    data: initialData,
    error: initialError,
    topicName: requestedTopicName,
  } = loaderData;
  const queryAction = action;
  const isSupportedAction = queryAction === "";

  const queryKey = useMemo(
    () => getTopicQueryKey(requestedTopicName, queryAction),
    [queryAction, requestedTopicName],
  );

  const topicQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadTopicPayloadFn({
        data: {
          action: queryAction,
          topicName: requestedTopicName,
        },
      });

      if (!result.data) {
        throw new Error(result.error || "Failed to load topic");
      }

      return result.data;
    },
    enabled: Boolean(requestedTopicName),
    initialData: initialData ?? undefined,
    retry: false,
    staleTime: 30_000,
  });

  const resolvedData = topicQuery.data ?? initialData;
  const resolvedError =
    topicQuery.error instanceof Error ? topicQuery.error.message : initialError;
  const topic = resolvedData?.topic;

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
  } else if (topic?.id && resolvedData) {
    if (!isSupportedAction) {
      content = <NotFoundPage />;
    } else {
      const { perspectives, link } = resolvedData;
      const requestedEditorId =
        typeof search.r === "string" ? search.r.trim() : "";
      const resolvedRequestedEditorId = requestedEditorId
        ? perspectives.find(
            (p: TopicPayload["perspectives"][number]) =>
              p.id === requestedEditorId,
          )?.id
        : undefined;
      const requestedViewerId =
        typeof search.p === "string" ? search.p.trim() : "";
      const resolvedRequestedViewerId = requestedViewerId
        ? perspectives.find(
            (p: TopicPayload["perspectives"][number]) => p.id === requestedViewerId,
          )?.id
        : undefined;
      const requestedWriteId =
        typeof search.w === "string" ? search.w.trim() : "";
      const requestsNewPerspective =
        requestedWriteId === NEW_PERSPECTIVE_QUERY_VALUE;
      const resolvedRequestedWriteId =
        requestedWriteId && !requestsNewPerspective
        ? perspectives.find(
            (p: TopicPayload["perspectives"][number]) => p.id === requestedWriteId,
          )?.id
        : undefined;
      const shouldShowEmptyWriteSurface =
        perspectives.length === 0 && topic.canWrite;
      const shouldShowNewWriteSurface =
        requestsNewPerspective && topic.canWrite;
      const shouldShowWriteSurface =
        Boolean(resolvedRequestedWriteId) ||
        shouldShowEmptyWriteSurface ||
        shouldShowNewWriteSurface;
      const writeSurfaceKey = resolvedRequestedWriteId
        ? `write-${resolvedRequestedWriteId}`
        : shouldShowNewWriteSurface
          ? `write-${NEW_PERSPECTIVE_QUERY_VALUE}`
          : "write-topic";
      const firstAudioId = perspectives.find(
        (p: TopicPayload["perspectives"][number]) => p.audio_src,
      )?.id;
      const swEditorPerspectives = resolvedRequestedEditorId
        ? perspectives.filter(
            (p: TopicPayload["perspectives"][number]) =>
              p.id === resolvedRequestedEditorId,
          )
        : perspectives;
      const viewerPerspectives = resolvedRequestedViewerId
        ? perspectives.filter(
            (p: TopicPayload["perspectives"][number]) =>
              p.id === resolvedRequestedViewerId,
          )
        : perspectives;
      const initialId =
        resolvedRequestedEditorId ?? firstAudioId ?? perspectives[0]?.id ?? "";
      const newPerspectiveHref = buildTopicNewPerspectiveHref(topic.name);
      const topicWriteActionHref = topic.canWrite
        ? newPerspectiveHref
        : buildTopicUnlockHref({
            topicName: topic.name,
            nextPath: newPerspectiveHref,
          });
      const topicWriteActionLabel = topic.canWrite
        ? "Add a perspective"
        : "Unlock to add a perspective";
      const topicWriteActionIcon = topic.canWrite ? "🖋️" : "🔓";

      const sharedSwProps = {
        perspectives: swEditorPerspectives,
        initialId,
        scrollToId: resolvedRequestedEditorId,
        topicId: topic.id,
        topicName: topic.name,
        canWrite: topic.canWrite,
        playbackProfile: "full-file" as const,
      };

      if (resolvedRequestedEditorId) {
        content = (
          <SW
            key={`editor-${resolvedRequestedEditorId}`}
            {...sharedSwProps}
            mode="editor"
            showPerspectiveModeNav
          />
        );
      } else if (resolvedRequestedViewerId) {
        const selectedPerspective = viewerPerspectives[0];
        content = selectedPerspective ? (
          <PerspectiveListener
            key={`viewer-${resolvedRequestedViewerId}`}
            perspective={selectedPerspective}
            topicName={topic.name}
            canWrite={topic.canWrite}
          />
        ) : (
          <NotFoundPage />
        );
      } else if (shouldShowWriteSurface) {
        content = (
          <WritePerspective
            key={writeSurfaceKey}
            id={topic.id}
            name={topic.name}
            topicEmoji={topic.emoji}
            perspectives={perspectives}
            forward
            link={link}
            initialPerspectiveId={resolvedRequestedWriteId}
            queryKey={queryKey}
            onRefresh={refreshTopicPayload}
          />
        );
      } else {
        content = (
          <div className="relative flex h-dvh w-full">
            <Link
              to={topicWriteActionHref}
              preload="intent"
              startTransition
              className="absolute top-3 right-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/30 text-lg text-white/90 no-underline backdrop-blur transition hover:border-white/40 hover:text-white"
              aria-label={topicWriteActionLabel}
              title={topicWriteActionLabel}
            >
              <span aria-hidden="true">{topicWriteActionIcon}</span>
            </Link>
            <SW
              key={`topic-${topic.id}`}
              perspectives={perspectives}
              initialId={initialId}
              topicId={topic.id}
              topicName={topic.name}
              canWrite={topic.canWrite}
              mode="viewer"
              playbackProfile="full-file"
              viewerPlayBehavior="open-perspective-page"
              showViewerEditLink={false}
            />
          </div>
        );
      }
    }
  }

  return (
    <main className="flex flex-col items-center h-dvh">
      <div className="flex flex-col flex-1">{content}</div>
    </main>
  );
}
