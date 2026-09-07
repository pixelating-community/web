import * as z from "zod/v4";
import { isValidContributionAmount } from "@/lib/perspectiveSupport";

const perspectiveIdSchema = z.uuid();

export const loadPerspectiveSupportSchema = z.object({
  perspectiveId: perspectiveIdSchema,
});

export const castPerspectiveVoteSchema = loadPerspectiveSupportSchema;

const contributionAmountSchema = z
  .number()
  .int()
  .refine(isValidContributionAmount, {
    message: "Enter a contribution of at least $1.00.",
  });

export const createPayPalContributionOrderSchema = z.object({
  amountMinor: contributionAmountSchema,
  perspectiveId: perspectiveIdSchema,
});

export const createStripeContributionSessionSchema = z.object({
  amountMinor: contributionAmountSchema,
  perspectiveId: perspectiveIdSchema,
});

export const reconcileStripeContributionSchema = z.object({
  perspectiveId: perspectiveIdSchema,
  sessionId: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^cs_[A-Za-z0-9_]+$/),
});

export const capturePayPalContributionOrderSchema = z.object({
  orderId: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9-]+$/),
  perspectiveId: perspectiveIdSchema,
});
