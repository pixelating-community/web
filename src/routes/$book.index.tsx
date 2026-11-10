import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BookApp } from "@/components/BookApp";
import { loadBookPage } from "@/lib/bookPage.functions";
export const Route = createFileRoute("/$book/")({
  loader: async ({ params }) => {
    const page = await loadBookPage({ data: { slug: params.book } });
    if (!page) throw notFound();
    if (page.book.slug !== params.book)
      throw redirect({ href: `/${page.book.slug}` });
    return page;
  },
  component: () => <BookApp page={Route.useLoaderData()} section="" />,
});
