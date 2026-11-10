export type BookSettings = {
  slug: string;
  title: string;
  author: string;
  introduction: string;
  price_minor: number | null;
};

export type BookChapter = {
  id: string;
  slug: string;
  title: string;
  position: number;
  published: boolean;
  free: boolean;
};

export type BookPerspective = { id: string; text: string };

export const bookPath = (slug: string) => `/${encodeURIComponent(slug)}`;
export const bookChapterPath = (bookSlug: string, chapterSlug: string) =>
  `${bookPath(bookSlug)}/c/${encodeURIComponent(chapterSlug)}`;
export const bookAuthorPath = (slug: string) => `${bookPath(slug)}/write`;

export const parseBookAmount = (value: string): number | null => {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) && amount >= 100 && amount <= 100_000
    ? amount
    : null;
};
