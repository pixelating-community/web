import * as z from "zod/v4";

const topicNameSchema = z.string().trim().min(1).max(255);

export const createTopicOwnerInviteSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  topicName: topicNameSchema,
});

export const claimTopicOwnerInviteSchema = z.object({
  token: z.string().trim().min(32).max(256),
  topicName: topicNameSchema,
});

export const loadCreatorSupportSetupSchema = z.object({
  topicName: topicNameSchema,
});

export const createStripeConnectOnboardingSchema =
  loadCreatorSupportSetupSchema;

export const saveCreatorSupportMethodsSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    paypalMeUrl: z.string().trim().max(512).optional(),
    topicName: topicNameSchema,
    venmoUrl: z.string().trim().max(512).optional(),
  })
  .refine(
    (data) => Boolean(data.paypalMeUrl?.trim() || data.venmoUrl?.trim()),
    { message: "Add a PayPal.Me or Venmo Business link." },
  );
