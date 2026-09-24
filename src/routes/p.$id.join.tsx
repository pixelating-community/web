import { createFileRoute } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/NotFoundPage";
import { PerspectiveBackground } from "@/components/PerspectiveBackground";
import { PerspectiveMarkup } from "@/components/PerspectiveMarkup";
import { PerspectiveShare } from "@/components/PerspectiveShare";
import { WritePerspective } from "@/components/WritePerspective";
import { loadPerspectiveJoin } from "@/lib/perspectiveJoin.functions";
import {
  buildPerspectiveJoinPath,
  buildTopicViewerPerspectivePath,
} from "@/lib/topicRoutes";
import type { Perspective } from "@/types/perspectives";

export const Route = createFileRoute("/p/$id/join")({
  loader: ({ params }) =>
    loadPerspectiveJoin({ data: { perspectiveId: params.id } }),
  pendingMs: 750,
  pendingComponent: () => (
    <main className="flex h-dvh items-center justify-center text-sm text-white/70">
      loading...
    </main>
  ),
  component: PerspectiveJoinRoute,
});

function PerspectiveJoinRoute() {
  const { data, error } = Route.useLoaderData();
  const navigate = Route.useNavigate();

  if (!data) {
    if (error.trim().toLowerCase() === "perspective not found") {
      return <NotFoundPage />;
    }
    return (
      <main className="flex h-dvh items-center justify-center px-4 text-center text-sm text-red-200">
        {error || "This collaboration invite is unavailable."}
      </main>
    );
  }

  const parentHref = buildTopicViewerPerspectivePath({
    topicName: data.topicName,
    perspectiveId: data.perspective.id,
  });

  if (data.canContribute && data.actionToken) {
    return (
      <WritePerspective
        actionToken={data.actionToken}
        createOnly
        id={data.topicId as Perspective["topic_id"]}
        name={data.topicName}
        topicEmoji={data.topicEmoji}
        topicShortTitle={data.topicShortTitle}
        perspectives={[data.perspective]}
        parentPerspectiveId={data.perspective.id}
        onCreateSuccess={() =>
          navigate({
            href: `${parentHref}#reflections`,
            replace: true,
            viewTransition: true,
          })
        }
      />
    );
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-4 py-16">
      <PerspectiveBackground
        imageSrc={data.perspective.image_src}
        overlayClassName="bg-black/30"
      />
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-5 rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm sm:p-6">
        <div className="max-h-[55dvh] overflow-y-auto rounded-xl bg-black/10 px-3 py-4 scrollbar-transparent">
          <PerspectiveMarkup
            perspective={data.perspective}
            className="sw-perspective-text whitespace-pre-line text-left"
          />
        </div>
        <div className="flex flex-col gap-2">
          <div className="text-center text-xs uppercase tracking-[0.18em] text-white/60">
            Join to add your reflection
          </div>
          <PerspectiveShare
            mode="redeem"
            perspective={data.perspective}
            onRedeemed={() => {
              window.location.assign(
                buildPerspectiveJoinPath(data.perspective.id),
              );
            }}
          />
          <p className="text-center text-[11px] text-white/45">
            Use the collaboration code that came with this link.
          </p>
        </div>
      </div>
    </main>
  );
}
