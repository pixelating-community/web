import { z } from "zod/v4";

const reserved = new Set([
  "api",
  "t",
  "c",
  "p",
  "sm",
  "assets",
  "favicon",
  "write",
]);
export const bookSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens.",
  )
  .refine((slug) => !reserved.has(slug), "This URL name is reserved.");
export const bookSettingsSchema = z.object({
  slug: bookSlugSchema,
  title: z.string().trim().min(1).max(160),
  author: z.string().trim().max(160),
  introduction: z.string().trim().max(10_000),
  price_minor: z.number().int().min(100).max(100_000).nullable(),
});
export const bookPerspectiveSchema = z.object({
  id: z.uuid(),
  text: z.string().max(50_000),
});
export const bookDraftSchema = z.object({
  title: z.string().trim().min(1).max(160),
  position: z.number().int().min(1).max(10_000),
  free: z.boolean(),
  perspectives: z
    .array(bookPerspectiveSchema)
    .max(200)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      "Each perspective must have its own ID.",
    ),
});
export const bookActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), key: z.string().min(1).max(512) }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("settings"), settings: bookSettingsSchema }),
  z.object({
    action: z.literal("createChapter"),
    title: z.string().trim().min(1).max(160),
    slug: bookSlugSchema,
  }),
  z.object({
    action: z.literal("saveDraft"),
    chapterId: z.uuid(),
    revision: z.number().int().nonnegative(),
    draft: bookDraftSchema,
  }),
  z.object({
    action: z.literal("publish"),
    chapterId: z.uuid(),
    revision: z.number().int().nonnegative(),
  }),
]);
export const bookCheckoutSchema = z.object({
  amountMinor: z.number().int().min(100).max(100_000),
});
