import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseTopicUnlockSearch } from "@/lib/routeSearch";
import { NotFoundPage } from "@/components/NotFoundPage";
import { Token } from "@/components/Token";
import { buildTopicPath, sanitizeTopicNextPath } from "@/lib/topicRoutes";
import { loadUnlockTopic } from "@/lib/topicUnlockRoute.functions";

const getNextAction = (nextPath: string) => {
  const segments = nextPath.split("/").filter(Boolean);
  if (segments[0] !== "t" || segments.length < 2) return "";
  return segments[2] ?? "";
};

export const Route = createFileRoute("/t/$topic/ul")({
  validateSearch: parseTopicUnlockSearch,
  loader: async ({ location, params }) => {
    const topicName = params.topic?.trim() ?? "";
    const fallbackPath = buildTopicPath(topicName);
    const search = parseTopicUnlockSearch(
      location.search as Record<string, unknown>,
    );
    const nextPath = sanitizeTopicNextPath({
      nextPath: search.next,
      fallbackPath,
    });
    const nextAction = getNextAction(nextPath);
    const requiresWriteToken =
      nextAction === "" || nextAction === "w" || nextAction === "r" || nextAction === "ke";
    const data = await loadUnlockTopic({
      data: {
        topicName,
      },
    });
    const hasAccess = requiresWriteToken ? data.canWrite : data.canAccess;

    if (!data.error && hasAccess) {
      throw redirect({
        href: nextPath,
        replace: true,
      });
    }

    return {
      ...data,
      nextPath,
    };
  },
  component: TopicUnlockRoute,
});

function TopicUnlockRoute() {
  const data = Route.useLoaderData();

  if (data.error) {
    return <NotFoundPage />;
  }

  return (
    <main className="flex h-dvh w-full items-center justify-center px-4">
      <div className="flex w-full max-w-xl flex-col gap-4">
        <div className="text-center text-2xl">🔒</div>
        <Token
          name={data.topicName}
          nextPath={data.nextPath}
          topicId={data.topicId}
        />
      </div>
    </main>
  );
}
