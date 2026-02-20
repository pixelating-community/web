import { z } from "zod/v4";

export const audioImportSchema = z.object({
  actionToken: z.string().min(1),
  topicId: z.uuid(),
  perspectiveId: z.uuid(),
  r2Key: z.string().min(1).optional(),
});
