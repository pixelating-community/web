import { createFileRoute, redirect } from "@tanstack/react-router";
import { Token } from "@/components/Token";
import { buildTopicPath, sanitizeTopicNextPath } from "@/lib/topicRoutes";
import { loadUnlockTopic } from "@/lib/topicUnlockRoute.functions";

const getNextAction = (nextPath: string) => {
  const segments = nextPath.split("/").filter(Boolean);
  if (segments[0] !== "t" || segments.length < 2) return "";
  return segments[2] ?? "";
};

export const Route = createFileRoute("/t/$topic/ul")({
  loader: async ({ location, params }) => {
    const topicName = params.topic?.trim() ?? "";
    const fallbackPath = buildTopicPath(topicName);
    const nextSearchParam =
      new URLSearchParams(location.searchStr).get("next") ?? undefined;
    const nextPath = sanitizeTopicNextPath({
      nextPath: nextSearchParam,
      fallbackPath,
    });
    const nextAction = getNextAction(nextPath);
    const normalizedNextAction = nextAction === "sw" ? "w" : nextAction;
    const requiresWriteToken =
      normalizedNextAction === "" || normalizedNextAction === "w";
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
    return (
      <main className="flex h-dvh w-full items-center justify-center px-4">
        <div className="text-sm text-red-200">{data.error}</div>
      </main>
    );
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
