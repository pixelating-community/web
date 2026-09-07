import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponseHeaders } from "@tanstack/react-start/server";
import {
  claimTopicOwnerInviteSchema,
  createStripeConnectOnboardingSchema,
  loadCreatorSupportSetupSchema,
  saveCreatorSupportMethodsSchema,
} from "@/lib/creatorSupport.schema";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

const resolveRequest = (context: unknown) =>
  (context as { request?: Request } | undefined)?.request ?? getRequest();

export const claimTopicOwnerInvite = createServerFn({ method: "POST" })
  .validator((value: unknown) => claimTopicOwnerInviteSchema.parse(value))
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    if (!rateLimit(`creator-invite-claim:${ip}`, 10, 60 * 60_000).ok) {
      return { ok: false as const, error: "Too many invite attempts." };
    }
    const { claimTopicOwnerInviteServer } =
      await import("@/lib/creatorSupport.server");
    const result = await claimTopicOwnerInviteServer({ data, request });
    if (result.ok) getResponseHeaders().append("Set-Cookie", result.setCookie);
    if (!result.ok) return result;
    return { ok: true as const, data: result.data };
  });

export const loadCreatorSupportSetup = createServerFn({ method: "GET" })
  .validator((value: unknown) => loadCreatorSupportSetupSchema.parse(value))
  .handler(async ({ data, context }) => {
    const { loadCreatorSupportSetupServer } =
      await import("@/lib/creatorSupport.server");
    return loadCreatorSupportSetupServer({
      data,
      request: resolveRequest(context),
    });
  });

export const saveCreatorSupportMethods = createServerFn({ method: "POST" })
  .validator((value: unknown) => saveCreatorSupportMethodsSchema.parse(value))
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    if (!rateLimit(`creator-support-save:${ip}`, 20, 60 * 60_000).ok) {
      return { ok: false as const, error: "Too many update attempts." };
    }
    const { saveCreatorSupportMethodsServer } =
      await import("@/lib/creatorSupport.server");
    return saveCreatorSupportMethodsServer({ data, request });
  });

export const createStripeConnectOnboarding = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    createStripeConnectOnboardingSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    if (!rateLimit(`creator-stripe-connect:${ip}`, 10, 60 * 60_000).ok) {
      return { ok: false as const, error: "Too many onboarding attempts." };
    }
    const { createStripeConnectOnboardingServer } =
      await import("@/lib/creatorSupport.server");
    return createStripeConnectOnboardingServer({ data, request });
  });
