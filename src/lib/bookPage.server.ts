import "@tanstack/react-start/server-only";
import {
  getBookSettings,
  listBookChapters,
  getBookChapter,
  getBookDraft,
} from "@/lib/book.server";
import { isBookAuthor, hasBookAuthorKey } from "@/lib/bookAuth.server";
import { getBookReader, hasBookPurchase } from "@/lib/bookAccess.server";
import { bookSalesReady, emailReady } from "@/lib/bookPayments.server";
export const bookPage = async (
  data: { slug: string; chapter?: string; draft?: string },
  request: Request,
) => {
  const book = await getBookSettings();
  if (data.slug !== book.slug && data.slug !== "book") return null;
  const author = isBookAuthor(request);
  return {
    book,
    author,
    authorConfigured: hasBookAuthorKey(),
    chapters: await listBookChapters(request),
    reader: await getBookReader(request),
    owns: await hasBookPurchase(request),
    salesReady: bookSalesReady() && Boolean(book.price_minor),
    emailReady: emailReady(),
    proofreadReady: author && Boolean(process.env.OPENAI_API_KEY),
    chapter: data.chapter ? await getBookChapter(data.chapter, request) : null,
    draft:
      author && data.draft ? await getBookDraft(data.draft, request) : null,
  };
};
