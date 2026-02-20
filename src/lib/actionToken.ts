import * as z from "zod/v4";

export const ACTION_TOKEN_VERSION = "a1";

export const actionScopeSchema = z.enum([
  "perspective:add",
  "perspective:edit",
  "perspective:delete",
  "perspective:align",
  "perspective:share",
]);

export type ActionScope = z.infer<typeof actionScopeSchema>;

export const TOPIC_UI_ACTION_SCOPES = [
  "perspective:add",
  "perspective:edit",
  "perspective:delete",
  "perspective:align",
  "perspective:share",
] as const satisfies readonly ActionScope[];

export const PERSPECTIVE_ALIGN_ACTION_SCOPES = [
  "perspective:align",
] as const satisfies readonly ActionScope[];

export const actionTokenPayloadSchema = z.object({
  version: z.literal(ACTION_TOKEN_VERSION),
  scopes: z.array(actionScopeSchema).min(1),
  topicId: z.uuid(),
  perspectiveId: z.uuid().optional(),
  requestId: z.string().min(1),
  issuedAt: z.number().int().nonnegative(),
});

export type ActionTokenPayload = z.infer<typeof actionTokenPayloadSchema>;
