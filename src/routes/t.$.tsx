import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { KaraokeListener } from "@/components/KaraokeListener";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PerspectiveListener } from "@/components/PerspectiveListener";
import { SW } from "@/components/SW";
import { WritePerspective } from "@/components/WritePerspective";
import { loadPerspectiveById } from "@/lib/getPerspectiveById.functions";
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
    topicName: string;
  };
}) => Promise<TopicPayloadQueryResult>;

const PERSPECTIVE_MODES = new Set(["w", "r", "p", "k", "ke"]);

const parseTopicSegments = (splat: string | undefined) => {
  const slug = splat ?? "";
  const parts = slug.split("/").filter(Boolean);
  const topicName = parts[0] ?? "";
  const second = parts[1] ?? "";
  if (PERSPECTIVE_MODES.has(second)) {
    return { topicName, mode: second, modeParam: parts[2] ?? "" };
  }
  return { topicName, mode: "", modeParam: "" };
};

const getWildcardParam = (params: Record<string, unknown>) => {
  const splat = params._splat;
  if (typeof splat === "string") return splat;
  const underscore = params._;
  if (typeof underscore === "string") return underscore;
  return undefined;
};

const getTopicQueryKey = (topicName: string) =>
  ["topic-payload", topicName] as const;

const DARK_TOPIC_NAME = "dark";
const TOPIC_SHELL_CLASS = "flex h-dvh w-full flex-col items-center";
const DARK_TOPIC_SHELL_CLASS = `${TOPIC_SHELL_CLASS} topic-dark bg-black text-white`;

const isDarkTopicName = (topicName: string | null | undefined) =>
  topicName?.trim().toLowerCase() === DARK_TOPIC_NAME;

const getTopicShellClassName = (topicName: string | null | undefined) =>
  isDarkTopicName(topicName) ? DARK_TOPIC_SHELL_CLASS : TOPIC_SHELL_CLASS;

const getTopicPayloadQueryOptions = ({
  loadTopicPayloadFn,
  topicName,
}: {
  loadTopicPayloadFn: LoadTopicPayloadFn;
  topicName: string;
}) =>
  queryOptions({
    queryKey: getTopicQueryKey(topicName),
    queryFn: async () => {
      if (!topicName) {
        return { data: null, error: "" };
      }

      return await loadTopicPayloadFn({
        data: {
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

    if (!topicName) {
      return { topicName, mode, modeParam };
    }

    const validatedSearch = parseTopicRouteSearch(
      location.search as Record<string, unknown>,
    );
    if (!mode) {
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
        wantsWriteAccess: mode === "r" || mode === "w" || mode === "ke",
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
  const search = Route.useSearch();
  const params = Route.useParams();
  const loadTopicPayloadFn = useServerFn(loadTopicPayload);
  const currentParsed = parseTopicSegments(
    getWildcardParam(params as Record<string, unknown>),
  );
  const { mode, modeParam } = currentParsed;
  const requestedTopicName = currentParsed.topicName || loaderData.topicName;

  const queryKey = useMemo(
    () => getTopicQueryKey(requestedTopicName),
    [requestedTopicName],
  );

  const topicQuery = useSuspenseQuery(
    getTopicPayloadQueryOptions({
      loadTopicPayloadFn,
      topicName: requestedTopicName,
    }),
  );

  const resolvedData = topicQuery.data.data;
  const resolvedError = topicQuery.data.error;
  const topic = resolvedData?.topic;
  const topicShellClassName = getTopicShellClassName(
    topic?.name ?? requestedTopicName,
  );

  const loadPerspectiveByIdFn = useServerFn(loadPerspectiveById);

  const requestedModeId = mode === "r" || mode === "p" || mode === "w" || mode === "k" || mode === "ke" ? modeParam : "";
  const perspectives = resolvedData?.perspectives ?? [];
  const isInTopLevel = requestedModeId
    ? perspectives.some((p: TopicPayload["perspectives"][number]) => p.id === requestedModeId)
    : true;
  const childPerspectiveQuery = useQuery({
    queryKey: ["perspective-by-id", requestedModeId],
    queryFn: () =>
      loadPerspectiveByIdFn({
        data: { perspectiveId: requestedModeId, topicName: requestedTopicName },
      }),
    enabled: Boolean(requestedModeId) && !isInTopLevel && !resolvedError,
    staleTime: 30_000,
  });
  const childPerspective = childPerspectiveQuery.data?.perspective ?? null;

  const refreshTopicPayload = async () => {
    await topicQuery.refetch();
  };

  let content: ReactNode = (
    <div className="text-sm text-white/80" aria-live="polite">
      🚚...
    </div>
  );

  if (resolvedError) {
    content = <NotFoundPage />;
  } else if (topic?.id && resolvedData) {
    const { ui } = resolvedData;

    const requestedEditorId = mode === "r" ? modeParam : "";
    const requestedViewerId = mode === "p" ? modeParam : "";
    const requestedWriteId = mode === "w" ? modeParam : "";
    const requestedKaraokeId = mode === "k" ? modeParam : "";
    const requestedKaraokeEditorId = mode === "ke" ? modeParam : "";

    const resolvedRequestedEditorId = requestedEditorId
      ? (perspectives.find(
          (p: TopicPayload["perspectives"][number]) =>
            p.id === requestedEditorId,
        )?.id ?? (childPerspective?.id === requestedEditorId ? requestedEditorId : undefined))
      : undefined;
    const resolvedRequestedViewerId = requestedViewerId
      ? (perspectives.find(
          (p: TopicPayload["perspectives"][number]) => p.id === requestedViewerId,
        )?.id ?? (childPerspective?.id === requestedViewerId ? requestedViewerId : undefined))
      : undefined;
    const requestsNewPerspective =
      requestedWriteId === NEW_PERSPECTIVE_QUERY_VALUE;
    const resolvedRequestedWriteId =
      requestedWriteId && !requestsNewPerspective
      ? (perspectives.find(
          (p: TopicPayload["perspectives"][number]) => p.id === requestedWriteId,
        )?.id ?? (childPerspective?.id === requestedWriteId ? requestedWriteId : undefined))
      : undefined;
    const resolvedRequestedKaraokeId = requestedKaraokeId
      ? (perspectives.find(
          (p: TopicPayload["perspectives"][number]) => p.id === requestedKaraokeId,
        )?.id ?? (childPerspective?.id === requestedKaraokeId ? requestedKaraokeId : undefined))
      : undefined;
    const resolvedRequestedKaraokeEditorId = requestedKaraokeEditorId
      ? (perspectives.find(
          (p: TopicPayload["perspectives"][number]) => p.id === requestedKaraokeEditorId,
        )?.id ?? (childPerspective?.id === requestedKaraokeEditorId ? requestedKaraokeEditorId : undefined))
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
    const swEditorPerspectives = resolvedRequestedEditorId
      ? (perspectives.find((p: TopicPayload["perspectives"][number]) => p.id === resolvedRequestedEditorId)
          ? perspectives.filter((p: TopicPayload["perspectives"][number]) => p.id === resolvedRequestedEditorId)
          : childPerspective ? [childPerspective as TopicPayload["perspectives"][number]] : [])
      : perspectives;
    const viewerPerspectives = resolvedRequestedViewerId
      ? (perspectives.find((p: TopicPayload["perspectives"][number]) => p.id === resolvedRequestedViewerId)
          ? perspectives.filter((p: TopicPayload["perspectives"][number]) => p.id === resolvedRequestedViewerId)
          : childPerspective ? [childPerspective as TopicPayload["perspectives"][number]] : [])
      : perspectives;
    const initialId =
      resolvedRequestedEditorId ?? perspectives[0]?.id ?? "";
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
          urlStartTime={search.s}
          urlEndTime={search.e}
        />
      );
    } else if (resolvedRequestedViewerId) {
      const selectedPerspective = viewerPerspectives[0];
      if (selectedPerspective) {
        content = (
          <PerspectiveListener
            key={`viewer-${resolvedRequestedViewerId}`}
            perspective={selectedPerspective}
            topicName={topic.name}
            canWrite={topic.canWrite}
            startTime={search.s}
            endTime={search.e}
          />
        );
      } else if (childPerspectiveQuery.isLoading) {
        // loading child perspective
      } else {
        content = <NotFoundPage />;
      }
    } else if (resolvedRequestedKaraokeId || resolvedRequestedKaraokeEditorId) {
      const karaokeId = resolvedRequestedKaraokeId ?? resolvedRequestedKaraokeEditorId;
      const karaokeEditable = Boolean(resolvedRequestedKaraokeEditorId);
      const karaokePerspective =
        perspectives.find((p: TopicPayload["perspectives"][number]) => p.id === karaokeId)
        ?? (childPerspective as TopicPayload["perspectives"][number] | null);
      if (karaokePerspective) {
        content = (
          <KaraokeListener
            key={`karaoke-${karaokeId}`}
            perspective={karaokePerspective}
            topicName={topic.name}
            canWrite={topic.canWrite}
            editable={karaokeEditable}
            videoSrc={search.v}
            imageSrc={search.i}
            startTime={
              karaokeEditable
                ? search.s ?? karaokePerspective.start_time ?? undefined
                : search.s
            }
            endTime={
              karaokeEditable
                ? search.e ?? karaokePerspective.end_time ?? undefined
                : search.e
            }
            topicId={topic.id}
            actionToken={ui?.actionToken}
            onBoundsSaved={refreshTopicPayload}
          />
        );
      } else if (childPerspectiveQuery.isLoading) {
        // loading child perspective
      } else {
        content = <NotFoundPage />;
      }
    } else if (shouldShowWriteSurface) {
      const writeChildPerspective =
        resolvedRequestedWriteId && !isInTopLevel && childPerspective
          ? childPerspective
          : null;
      const writePerspectives = writeChildPerspective
        ? [...perspectives, writeChildPerspective as TopicPayload["perspectives"][number]]
        : perspectives;
      content = (
        <WritePerspective
          key={writeSurfaceKey}
          actionToken={ui?.actionToken}
          id={topic.id}
          name={topic.name}
          topicEmoji={topic.emoji}
          topicShortTitle={topic.shortTitle}
          perspectives={writePerspectives}
          forward
          initialPerspectiveId={resolvedRequestedWriteId}
          parentPerspectiveId={
            search.parent ??
            (writeChildPerspective?.parent_perspective_id ?? undefined)
          }
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
            viewTransition
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
    <main className={topicShellClassName}>
      <div className="flex w-full flex-col flex-1 min-h-0">{content}</div>
    </main>
  );
}
