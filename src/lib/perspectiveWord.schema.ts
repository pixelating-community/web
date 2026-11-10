import { z } from "zod/v4";

export const perspectiveWordSchema = z.object({
  actionToken: z.string().min(1),
  topicId: z.uuid(),
  perspectiveId: z.uuid(),
  index: z.number().int().nonnegative(),
  expectedWord: z.string().min(1),
  word: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^\S+$/, "Enter one word without spaces."),
});
