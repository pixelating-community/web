import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { z } from "zod/v4";
import { NotFoundPage } from "@/components/NotFoundPage";
import type { SWPlaybackMode } from "@/components/SW";
import { SW } from "@/components/SW";
import { compilePerspective } from "@/lib/compilePerspective";
import { sql } from "@/lib/db";
import { normalizeTimings } from "@/lib/perspectiveTimings";
import { buildTopicPath } from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

type PromptResponse = {
  perspectives: Perspective[];
  initialPerspectiveId: string;
  topicId: string;
  topicName: string;
  topicShortTitle?: string;
  topicEmoji?: string;
};

type PerspectiveRouteLoaderData = {
  data: PromptResponse | null;
  error: string;
};

const loadPromptPayload = createServerFn({ method: "GET" })
  .inputValidator((value: { id?: string }) => value)
  .handler(async ({ data }): Promise<PerspectiveRouteLoaderData> => {
    const id = data.id?.trim() ?? "";
    const schema = z.object({ id: z.uuid() });
    let parsed: { id: string };

    try {
      parsed = schema.parse({ id });
    } catch {
      return { data: null, error: "Invalid id" };
    }

    try {
      const rows = await sql<{
        id: string;
        perspective: string;
        topic_id: string;
        topic_name: string;
        topic_short_title?: string | null;
        topic_emoji?: string | null;
        collection_id?: string | null;
        rendered_html?: string | null;
        words_json?: string | null;
        audio_src?: string | null;
        start_time?: number | null;
        end_time?: number | null;
      }>`
        SELECT
          p.id,
          p.perspective,
          p.topic_id,
          t.name AS topic_name,
          t.short_title AS topic_short_title,
          t.emoji AS topic_emoji,
          p.collection_id,
          p.rendered_html,
          p.words_json,
          p.audio_src,
          p.start_time,
          p.end_time
        FROM perspectives AS p
        JOIN topics AS t ON t.id = p.topic_id
        WHERE p.id = ${parsed.id}
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return { data: null, error: "Perspective not found" };
      }

      const row = rows[0];
      const compiled = compilePerspective(String(row.perspective ?? ""));
      const wordTimings = normalizeTimings(row.words_json ?? null);
      const perspective: Perspective = {
        id: row.id as Perspective["id"],
        perspective: String(row.perspective ?? ""),
        topic_id: row.topic_id as Perspective["topic_id"],
        collection_id: row.collection_id
          ? (row.collection_id as Perspective["collection_id"])
          : undefined,
        rendered_html: compiled.renderedHtml,
        words: compiled.words,
        wordTimings,
        audio_src: row.audio_src ?? undefined,
        start_time: row.start_time ?? undefined,
        end_time: row.end_time ?? undefined,
      };

      return {
        data: {
          perspectives: [perspective],
          initialPerspectiveId: perspective.id,
          topicId: perspective.topic_id,
          topicName: row.topic_name,
          topicShortTitle: row.topic_short_title ?? undefined,
          topicEmoji: row.topic_emoji ?? undefined,
        },
        error: "",
      };
    } catch (error) {
      console.error(error, { message: "Failed to load perspective payload" });
      return { data: null, error: "Failed to load perspective" };
    }
  });

export const Route = createFileRoute("/p/$id")({
  loader: ({ params }): Promise<PerspectiveRouteLoaderData> =>
    loadPromptPayload({
      data: { id: params.id },
    }),
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
  const search = Route.useSearch() as { m?: string };
  const isLeafPerspectiveRoute = leafRouteId === Route.id;
  const isNotFound = error.trim().toLowerCase() === "perspective not found";
  const playbackMode: SWPlaybackMode = search.m === "s" ? "sequence" : "single";
  const topicEmoji = data?.topicEmoji?.trim() || "🧭";
  const topicLabel = data?.topicShortTitle?.trim() || data?.topicName || "topic";
  const topicHref = data?.topicName
    ? `${buildTopicPath(data.topicName)}?p=${encodeURIComponent(data.initialPerspectiveId)}`
    : "";
  const handlePlaybackComplete = useCallback(
    (_perspectiveId: string) => {
      if (!data?.topicName) return;
      void navigate({
        href: topicHref,
        replace: true,
      });
    },
    [data?.topicName, navigate, topicHref],
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

  return (
    <main className="relative flex h-dvh w-full flex-col items-center">
      <div className="flex min-h-0 flex-1 w-full">
        <SW
          perspectives={data.perspectives}
          initialId={data.initialPerspectiveId}
          scrollToId={data.initialPerspectiveId}
          topicId={data.topicId}
          mode="viewer"
          playbackProfile="full-file"
          playbackMode={playbackMode}
          viewerPlayBehavior="inline"
          onViewerPlaybackComplete={handlePlaybackComplete}
        />
      </div>
      <a
        href={topicHref}
        aria-label={`Open topic: ${topicLabel}`}
        title={`Open topic: ${topicLabel}`}
        className="absolute bottom-20 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-xl text-white/90 backdrop-blur transition hover:border-white/40 hover:text-white"
      >
        {topicEmoji}
      </a>
    </main>
  );
}
