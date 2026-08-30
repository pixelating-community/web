import { createServerFn } from "@tanstack/react-start";
import { getRequest, getResponseHeaders } from "@tanstack/react-start/server";
import { getClientIp, rateLimit } from "@/lib/rateLimit";
import {
  capturePayPalContributionOrderSchema,
  castPerspectiveVoteSchema,
  createPayPalContributionOrderSchema,
  createStripeContributionSessionSchema,
  loadPerspectiveSupportSchema,
  reconcileStripeContributionSchema,
} from "@/lib/perspectiveSupport.schema";

const resolveRequest = (context: unknown) =>
  (context as { request?: Request } | undefined)?.request ?? getRequest();

export const loadPerspectiveSupport = createServerFn({ method: "GET" })
  .validator((value: { perspectiveId?: string }) =>
    loadPerspectiveSupportSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const { loadPerspectiveSupportServer } = await import(
      "@/lib/perspectiveSupport.server"
    );
    return loadPerspectiveSupportServer({
      data,
      request: resolveRequest(context),
    });
  });

export const castPerspectiveVote = createServerFn({ method: "POST" })
  .validator((value: { perspectiveId?: string }) =>
    castPerspectiveVoteSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    const rate = rateLimit(`perspective-vote:${ip}:${data.perspectiveId}`, 20, 60_000);
    if (!rate.ok) {
      return { ok: false as const, error: "Too many vote attempts." };
    }
    const { castPerspectiveVoteServer } = await import(
      "@/lib/perspectiveSupport.server"
    );
    const result = await castPerspectiveVoteServer({ data, request });
    if (result.ok && result.voterToken) {
      const { buildVoterCookie } = await import(
        "@/lib/perspectiveSupportIdentity.server"
      );
      getResponseHeaders().append(
        "Set-Cookie",
        buildVoterCookie(result.voterToken),
      );
    }
    if (!result.ok) return result;
    return { ok: true as const, data: result.data };
  });

export const createPayPalContributionOrder = createServerFn({ method: "POST" })
  .validator((value: { amountMinor?: number; perspectiveId?: string }) =>
    createPayPalContributionOrderSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    const rate = rateLimit(
      `contribution-create:${ip}:${data.perspectiveId}`,
      10,
      60 * 60_000,
    );
    if (!rate.ok) {
      return { ok: false as const, error: "Too many checkout attempts." };
    }
    const { createPayPalContributionOrderServer } = await import(
      "@/lib/perspectiveSupport.server"
    );
    return createPayPalContributionOrderServer({ data });
  });

export const capturePayPalContributionOrder = createServerFn({ method: "POST" })
  .validator(
    (value: { orderId?: string; perspectiveId?: string }) =>
      capturePayPalContributionOrderSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    const rate = rateLimit(
      `contribution-capture:${ip}:${data.orderId}`,
      10,
      60 * 60_000,
    );
    if (!rate.ok) {
      return { ok: false as const, error: "Too many capture attempts." };
    }
    const { capturePayPalContributionOrderServer } = await import(
      "@/lib/perspectiveSupport.server"
    );
    return capturePayPalContributionOrderServer({ data, request });
  });

export const createStripeContributionSession = createServerFn({
  method: "POST",
})
  .validator((value: { amountMinor?: number; perspectiveId?: string }) =>
    createStripeContributionSessionSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    const rate = rateLimit(
      `stripe-contribution-create:${ip}:${data.perspectiveId}`,
      10,
      60 * 60_000,
    );
    if (!rate.ok) {
      return { ok: false as const, error: "Too many checkout attempts." };
    }
    const { createStripeContributionSessionServer } = await import(
      "@/lib/perspectiveSupport.server"
    );
    return createStripeContributionSessionServer({ data, request });
  });

export const reconcileStripeContribution = createServerFn({ method: "POST" })
  .validator((value: { perspectiveId?: string; sessionId?: string }) =>
    reconcileStripeContributionSchema.parse(value),
  )
  .handler(async ({ data, context }) => {
    const request = resolveRequest(context);
    const ip = getClientIp(request.headers);
    const rate = rateLimit(
      `stripe-contribution-reconcile:${ip}:${data.sessionId}`,
      20,
      60 * 60_000,
    );
    if (!rate.ok) {
      return { ok: false as const, error: "Too many verification attempts." };
    }
    const { reconcileStripeContributionServer } = await import(
      "@/lib/perspectiveSupport.server"
    );
    return reconcileStripeContributionServer({ data, request });
  });
