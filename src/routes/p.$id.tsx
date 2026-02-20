import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PerspectiveListener } from "@/components/PerspectiveListener";
import { loadPerspectivePayload } from "@/lib/perspectiveRoute.functions";
import type { PerspectiveRouteLoaderData } from "@/lib/perspectiveRoute.server";
import { buildTopicPath } from "@/lib/topicRoutes";

export const Route = createFileRoute("/p/$id")({
  loader: ({ params }): Promise<PerspectiveRouteLoaderData> =>
    loadPerspectivePayload({
      data: { id: params.id },
    }),
  pendingMs: 1500,
  preloadStaleTime: 30_000,
  pendingComponent: PerspectivePending,
  component: PerspectiveRoute,
});

function PerspectivePending() {
  return (
    <div className="flex items-center justify-center h-dvh text-sm text-white/80">
      loading...
    </div>
  );
}

function PerspectiveRoute() {
  const { data, error } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const leafRouteId = useRouterState({
    select: (state) => state.matches[state.matches.length - 1]?.routeId,
  });
  const isLeafPerspectiveRoute = leafRouteId === Route.id;
  const isNotFound = error.trim().toLowerCase() === "perspective not found";
  const recordHref = data?.topicName
    ? `${buildTopicPath(data.topicName)}?r=${encodeURIComponent(data.initialPerspectiveId)}`
    : "";
  const handlePlaybackComplete = useCallback(
    (_perspectiveId: string) => {
      if (!data?.topicName) return;
      void navigate({
        href: recordHref,
        replace: true,
        startTransition: true,
      });
    },
    [data?.topicName, navigate, recordHref],
  );

  if (!isLeafPerspectiveRoute) {
    return <Outlet />;
  }

  if (isNotFound) {
    return <NotFoundPage />;
  }

  if (error || !data?.perspectives?.length) {
    return (
      <div className="flex items-center justify-center h-dvh text-sm text-red-200">
        {error || "Perspective not found"}
      </div>
    );
  }

  const selectedPerspective = data.perspectives[0];
  if (!selectedPerspective) {
    return <NotFoundPage />;
  }

  return (
    <main className="relative flex h-dvh w-full flex-col items-center">
      <div className="flex min-h-0 flex-1 w-full">
        <PerspectiveListener
          perspective={selectedPerspective}
          topicName={data.topicName}
          canWrite={data.canWrite}
          onPlaybackComplete={handlePlaybackComplete}
        />
      </div>
    </main>
  );
}
