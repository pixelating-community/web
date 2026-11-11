import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { bookChapterPath, bookPath, bookSections } from "@/lib/book";
import { loadBookPage } from "@/lib/bookPage.functions";

export const Route = createFileRoute("/$book/$")({
  loader: async ({ params, location }) => {
    const section = params._splat ?? "";
    const chapter = /^c\/([a-z0-9-]+)$/.exec(section)?.[1];
    if (!chapter && !bookSections.has(section)) throw notFound();

    const page = await loadBookPage({ data: { slug: params.book } });
    if (
      !page ||
      (chapter && !page.chapters.some((item) => item.slug === chapter))
    )
      throw notFound();

    const path = chapter
      ? bookChapterPath(page.book.slug, chapter)
      : `${bookPath(page.book.slug)}/${section}`;
    throw redirect({ href: path + location.searchStr });
  },
});
