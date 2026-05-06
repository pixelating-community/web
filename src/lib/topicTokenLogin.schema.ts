import { z } from "zod/v4";

export const topicTokenLoginSchema = z.object({
  token: z.string().min(1),
  topicId: z.uuid(),
  topicName: z.string().min(1),
});

