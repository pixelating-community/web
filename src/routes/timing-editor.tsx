import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { NotFoundPage } from "@/components/NotFoundPage";
import { isTimingEditorEnabled } from "@/lib/featureFlags";

export const Route = createFileRoute("/timing-editor")({
  component: TimingEditorRoute,
});

const TimingEditorSurface = lazy(() =>
  import("@/components/TimingEditorSurface").then((module) => ({
    default: module.TimingEditorSurface,
  })),
);

function TimingEditorRoute() {
  if (!isTimingEditorEnabled()) {
    return <NotFoundPage />;
  }

  return (
    <main className="h-dvh w-full">
      <Suspense fallback={<div className="topic-dark h-dvh w-full bg-black" />}>
        <TimingEditorSurface />
      </Suspense>
    </main>
  );
}
