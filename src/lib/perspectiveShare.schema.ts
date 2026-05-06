import { z } from "zod/v4";

export const loadPerspectiveShareStatusSchema = z.object({
  actionToken: z.string().min(1),
  perspectiveId: z.uuid(),
  topicId: z.uuid(),
});

export const generatePerspectiveShareCodeSchema = z.object({
  actionToken: z.string().min(1),
  perspectiveId: z.uuid(),
  topicId: z.uuid(),
});

export const redeemPerspectiveShareCodeSchema = z.object({
  code: z.string().min(1),
  perspectiveId: z.uuid(),
});

