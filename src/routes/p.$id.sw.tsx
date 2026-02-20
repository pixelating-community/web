import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { NotFoundPage } from "@/components/NotFoundPage";
import { sql } from "@/lib/db";
import { buildTopicPath } from "@/lib/topicRoutes";

type PerspectiveSwLoaderData = {
  error: string;
  href: string;
};

const loadPerspectiveSwTarget = createServerFn({ method: "GET" })
  .inputValidator((value: { id?: string }) => value)
  .handler(async ({ data }): Promise<PerspectiveSwLoaderData> => {
    const id = data.id?.trim() ?? "";
    const schema = z.object({ id: z.uuid() });
    let parsed: { id: string };

    try {
      parsed = schema.parse({ id });
    } catch {
      return { href: "", error: "Invalid id" };
    }

    try {
      const rows = await sql<{ topic_name: string }>`
        SELECT t.name AS topic_name
        FROM perspectives AS p
        JOIN topics AS t ON t.id = p.topic_id
        WHERE p.id = ${parsed.id}
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return { href: "", error: "Perspective not found" };
      }

      const topicName = rows[0]?.topic_name?.trim() ?? "";
      if (!topicName) {
        return { href: "", error: "Perspective not found" };
      }

      return {
        href: `${buildTopicPath(topicName, "w")}?p=${encodeURIComponent(parsed.id)}`,
        error: "",
      };
    } catch (error) {
      console.error(error, {
        message: "Failed to resolve legacy perspective /sw redirect",
      });
      return { href: "", error: "Failed to load perspective" };
    }
  });

export const Route = createFileRoute("/p/$id/sw")({
  loader: async ({ params }) => {
    const data = await loadPerspectiveSwTarget({ data: { id: params.id } });
    if (data.href) {
      throw redirect({
        href: data.href,
        replace: true,
      });
    }
    return data;
  },
  component: PerspectiveSwRedirect,
});

function PerspectiveSwRedirect() {
  const { error } = Route.useLoaderData();
  const isNotFound = error.trim().toLowerCase() === "perspective not found";

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return (
    <main className="flex items-center justify-center h-dvh text-sm text-red-200">
      {error || "Failed to open perspective"}
    </main>
  );
}
