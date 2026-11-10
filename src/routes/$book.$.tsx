import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BookApp } from "@/components/BookApp";
import { loadBookPage } from "@/lib/bookPage.functions";
export const Route = createFileRoute("/$book/$")({
  validateSearch: (value: Record<string, unknown>) => ({
    draft: typeof value.draft === "string" ? value.draft : undefined,
    token: typeof value.token === "string" ? value.token : undefined,
    session_id:
      typeof value.session_id === "string" ? value.session_id : undefined,
  }),
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  loader: async ({ params, deps, location }) => {
    const section = params._splat ?? "";
    if (
      !["write", "sign-in", "checkout/return"].includes(section) &&
      !/^c\/[a-z0-9-]+$/.test(section)
    )
      throw notFound();
    const page = await loadBookPage({
      data: {
        slug: params.book,
        chapter: section.startsWith("c/") ? section.slice(2) : undefined,
        draft: section === "write" ? deps.draft : undefined,
      },
    });
    if (!page || (section.startsWith("c/") && !page.chapter)) throw notFound();
    if (page.book.slug !== params.book)
      throw redirect({
        href: `/${page.book.slug}/${section}${location.searchStr}`,
      });
    return { page, section };
  },
  component: () => {
    const { page, section } = Route.useLoaderData();
    return (
      <BookApp
        key={`${section}:${page.draft?.chapter.id ?? ""}`}
        page={page}
        section={section}
      />
    );
  },
});
