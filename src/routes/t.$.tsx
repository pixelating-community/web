import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PerspectiveListener } from "@/components/PerspectiveListener";
import { SW } from "@/components/SW";
import { WritePerspective } from "@/components/WritePerspective";
import { loadTopicPayload } from "@/lib/topicPayloadRoute.functions";
import { parseTopicRouteSearch } from "@/lib/routeSearch";
import {
  buildTopicNewPerspectivePath,
  buildTopicPath,
  buildTopicPerspectivePath,
  buildTopicUnlockHref,
  buildTopicViewerPerspectivePath,
  buildTopicWritePerspectivePath,
  NEW_PERSPECTIVE_QUERY_VALUE,
} from "@/lib/topicRoutes";
import { shouldRequireTopicUnlock } from "@/lib/topicWriteAccess";
import type { TopicPayload, TopicPayloadQueryResult } from "@/types/topic";

type TopicRouteLoaderData = {
  topicName: string;
  mode: string;
  modeParam: string;
};

type LoadTopicPayloadFn = (input: {
  data: {
    action: string;
    topicName: string;
  };
}) => Promise<TopicPayloadQueryResult>;

const PERSPECTIVE_MODES = new Set(["w", "r", "p"]);

const parseTopicSegments = (splat: string | undefined) => {
  const slug = splat ?? "";
  const parts = slug.split("/").filter(Boolean);
  const topicName = parts[0] ?? "";
  const second = parts[1] ?? "";
  // If second segment is a known perspective mode, the third segment is the param
  if (PERSPECTIVE_MODES.has(second)) {
    return { topicName, mode: second, modeParam: parts[2] ?? "" };
  }
  // Otherwise treat second as a legacy action (e.g. "f", legacy "w")
  return { topicName, mode: "", modeParam: "", legacyAction: second };
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

const getTopicPayloadQueryOptions = ({
  action,
  loadTopicPayloadFn,
  topicName,
}: {
  action: string;
  loadTopicPayloadFn: LoadTopicPayloadFn;
  topicName: string;
}) =>
  queryOptions({
    queryKey: getTopicQueryKey(topicName, action),
    queryFn: async () => {
      if (!topicName) {
        return { data: null, error: "" };
      }

      return await loadTopicPayloadFn({
        data: {
          action,
          topicName,
        },
      });
    },
    staleTime: 30_000,
  });

export const Route = createFileRoute("/t/$")({
  validateSearch: parseTopicRouteSearch,
  loader: async ({ context, location, params }): Promise<TopicRouteLoaderData> => {
    const parsed = parseTopicSegments(
      getWildcardParam(params as Record<string, unknown>),
    );
    const { topicName, mode, modeParam } = parsed;
    const legacyAction = "legacyAction" in parsed ? parsed.legacyAction ?? "" : "";

    if (!topicName) {
      return { topicName, mode, modeParam };
    }

    // Legacy action redirects (e.g. /t/topic/f, /t/topic/w)
    if (legacyAction === "f") {
      throw redirect({
        href: buildTopicPath(topicName),
        replace: true,
      });
    }
    if (legacyAction === "w") {
      throw redirect({
        href: buildTopicPath(topicName),
        replace: true,
      });
    }

    // Backwards-compat: redirect old ?w=, ?r=, ?p= query params to path segments
    const validatedSearch = parseTopicRouteSearch(
      location.search as Record<string, unknown>,
    );
    if (!mode && !legacyAction) {
      if (validatedSearch.w) {
        throw redirect({
          href: validatedSearch.w === NEW_PERSPECTIVE_QUERY_VALUE
            ? buildTopicNewPerspectivePath(topicName)
            : buildTopicWritePerspectivePath({ topicName, perspectiveId: validatedSearch.w }),
          replace: true,
        });
      }
      if (validatedSearch.r) {
        throw redirect({
          href: buildTopicPerspectivePath({ topicName, perspectiveId: validatedSearch.r }),
          replace: true,
        });
      }
      if (validatedSearch.p) {
        throw redirect({
          href: buildTopicViewerPerspectivePath({ topicName, perspectiveId: validatedSearch.p }),
          replace: true,
        });
      }
    }

    const result = await context.queryClient.ensureQueryData(
      getTopicPayloadQueryOptions({
        action: "",
        loadTopicPayloadFn: loadTopicPayload,
        topicName,
      }),
    );
    const resolvedTopicName = result.data?.topic.name ?? topicName;
    const requestedPath = mode && modeParam
      ? `${buildTopicPath(resolvedTopicName)}/${mode}/${encodeURIComponent(modeParam)}`
      : buildTopicPath(resolvedTopicName);

    if (
      result.data?.topic.id &&
      shouldRequireTopicUnlock({
        locked: Boolean(result.data.topic.locked),
        canAccess: Boolean(result.data.topic.canAccess),
        canWrite: Boolean(result.data.topic.canWrite),
        wantsWriteAccess: mode === "r" || mode === "w",
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
      topicName,
      mode,
      modeParam,
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
  const { mode, modeParam, topicName: requestedTopicName } = loaderData;

  const queryKey = useMemo(
    () => getTopicQueryKey(requestedTopicName, ""),
    [requestedTopicName],
  );

  const topicQuery = useSuspenseQuery(
    getTopicPayloadQueryOptions({
      action: "",
      loadTopicPayloadFn,
      topicName: requestedTopicName,
    }),
  );

  const resolvedData = topicQuery.data.data;
  const resolvedError = topicQuery.data.error;
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
    const { perspectives, link, ui } = resolvedData;

    // Derive perspective selection from path segments
    const requestedEditorId = mode === "r" ? modeParam : "";
    const requestedViewerId = mode === "p" ? modeParam : "";
    const requestedWriteId = mode === "w" ? modeParam : "";

    const resolvedRequestedEditorId = requestedEditorId
      ? perspectives.find(
          (p: TopicPayload["perspectives"][number]) =>
            p.id === requestedEditorId,
        )?.id
      : undefined;
    const resolvedRequestedViewerId = requestedViewerId
      ? perspectives.find(
          (p: TopicPayload["perspectives"][number]) => p.id === requestedViewerId,
        )?.id
      : undefined;
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
    const newPerspectiveHref = buildTopicNewPerspectivePath(topic.name);
    const topicWriteActionHref = topic.canWrite
      ? newPerspectiveHref
      : buildTopicUnlockHref({
          topicName: topic.name,
          nextPath: newPerspectiveHref,
        });
    const topicWriteActionLabel = topic.canWrite
      ? "Add a perspective"
      : "Unlock to add a perspective";
    const topicWriteActionIcon = topic.canWrite ? "⊕" : "🔓";

    const sharedSwProps = {
      perspectives: swEditorPerspectives,
      initialId,
      scrollToId: resolvedRequestedEditorId,
      topicId: topic.id,
      topicName: topic.name,
      actionToken: ui?.actionToken,
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
          actionToken={ui?.actionToken}
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
            className="unstyled-link absolute top-3 right-3 z-30 inline-flex h-10 w-10 items-center justify-center border-0 bg-transparent text-lg text-white/90 transition hover:text-white"
            aria-label={topicWriteActionLabel}
            title={topicWriteActionLabel}
          >
            <span aria-hidden="true">{topicWriteActionIcon}</span>
          </Link>
          <SW
            key={`topic-${topic.id}`}
            actionToken={ui?.actionToken}
            perspectives={perspectives}
            initialId={initialId}
            topicId={topic.id}
            topicName={topic.name}
            canWrite={topic.canWrite}
            mode="viewer"
            playbackProfile="full-file"
            viewerPlayBehavior="open-perspective-page"
            showViewerEditLink
          />
        </div>
      );
    }
  }

  return (
    <main className="flex flex-col items-center h-dvh">
      <div className="flex flex-col flex-1">{content}</div>
    </main>
  );
}
