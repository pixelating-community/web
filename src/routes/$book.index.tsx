import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { bookPath } from "@/lib/book";
import { loadBookPage } from "@/lib/bookPage.functions";

export const Route = createFileRoute("/$book/")({
  loader: async ({ params, location }) => {
    const page = await loadBookPage({ data: { slug: params.book } });
    if (!page) throw notFound();
    throw redirect({ href: bookPath(page.book.slug) + location.searchStr });
  },
});
