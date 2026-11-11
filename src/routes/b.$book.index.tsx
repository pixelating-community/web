import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BookApp } from "@/components/BookApp";
import { bookPath } from "@/lib/book";
import { loadBookPage } from "@/lib/bookPage.functions";

export const Route = createFileRoute("/b/$book/")({
  loader: async ({ params, location }) => {
    const page = await loadBookPage({ data: { slug: params.book } });
    if (!page) throw notFound();
    if (page.book.slug !== params.book)
      throw redirect({ href: bookPath(page.book.slug) + location.searchStr });
    return page;
  },
  component: () => <BookApp page={Route.useLoaderData()} section="" />,
});
