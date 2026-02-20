import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/t/$topic/tools")({
  component: TopicToolsPlaceholder,
});

function TopicToolsPlaceholder() {
  const { topic } = Route.useParams();

  return (
    <main className="flex h-dvh w-full items-center justify-center px-4">
      <div className="w-full max-w-xl border border-white/15 bg-white/5 p-3 text-xs text-white/75">
        <div className="font-medium text-white/90">Token tools</div>
        <p className="mt-1">
          This is the placeholder for collaborator token generation and rotation
          controls.
        </p>
        <div className="mt-2">
          <Link
            to="/t/$"
            params={{ _splat: topic }}
            className="underline underline-offset-2"
          >
            open topic
          </Link>
        </div>
      </div>
    </main>
  );
}
