import "@tanstack/react-start/server-only";
import Stripe from "stripe";
import { getServerEnv } from "@/lib/env.server";
import {
  isLivePaymentsEnabled,
  isPaymentEnvironmentAllowed,
  resolveStripeEnvironment,
} from "@/lib/paymentEnvironment";
import { SUPPORT_CURRENCY } from "@/lib/perspectiveSupport";

const globalCache = globalThis as typeof globalThis & {
  __pxl8Stripe?: Stripe;
  __pxl8StripeSecret?: string;
};

const getStripeSecretKey = () => getServerEnv("STRIPE_SECRET_KEY");

const isEnabled = (value: string | undefined) =>
  value ? ["1", "true", "yes"].includes(value.trim().toLowerCase()) : false;

export const getStripePublicConfig = () => {
  const publishableKey = getServerEnv(
    "STRIPE_PUBLISHABLE_KEY",
    "VITE_STRIPE_PUBLISHABLE_KEY",
  );
  const secretKey = getStripeSecretKey();
  const environment = resolveStripeEnvironment({ publishableKey, secretKey });
  const environmentAllowed = isPaymentEnvironmentAllowed({
    environment,
    livePaymentsEnabled: isLivePaymentsEnabled(
      getServerEnv("PAYMENTS_LIVE_ENABLED"),
    ),
  });
  const webhookConfigured = Boolean(getServerEnv("STRIPE_WEBHOOK_SECRET"));
  return {
    currency: SUPPORT_CURRENCY,
    enabled: Boolean(
      environmentAllowed &&
      (process.env.NODE_ENV !== "production" || webhookConfigured),
    ),
    environment: environment ?? "sandbox",
    publishableKey: publishableKey ?? null,
  };
};

export const getStripeConnectConfig = () => {
  const stripe = getStripePublicConfig();
  const requested = isEnabled(getServerEnv("STRIPE_CONNECT_ENABLED"));
  const approved = isEnabled(getServerEnv("STRIPE_CONNECT_APPROVED"));
  const approvalRequired = stripe.environment === "live" && !approved;
  return {
    approvalRequired,
    enabled: Boolean(
      requested &&
        stripe.enabled &&
        getServerEnv("STRIPE_CONNECT_WEBHOOK_SECRET") &&
        !approvalRequired,
    ),
  };
};

export const getStripeClient = () => {
  const secretKey = getStripeSecretKey();
  if (!secretKey) throw new Error("Stripe contributions are not configured.");
  const publishableKey = getServerEnv(
    "STRIPE_PUBLISHABLE_KEY",
    "VITE_STRIPE_PUBLISHABLE_KEY",
  );
  const environment = resolveStripeEnvironment({ publishableKey, secretKey });
  if (!environment) {
    throw new Error(
      "Stripe publishable and secret keys must use the same mode.",
    );
  }
  if (
    !isPaymentEnvironmentAllowed({
      environment,
      livePaymentsEnabled: isLivePaymentsEnabled(
        getServerEnv("PAYMENTS_LIVE_ENABLED"),
      ),
    })
  ) {
    throw new Error("Live Stripe payments are not enabled.");
  }
  if (
    !globalCache.__pxl8Stripe ||
    globalCache.__pxl8StripeSecret !== secretKey
  ) {
    globalCache.__pxl8Stripe = new Stripe(secretKey, {
      appInfo: {
        name: "PXL8",
        version: "1",
      },
    });
    globalCache.__pxl8StripeSecret = secretKey;
  }
  return globalCache.__pxl8Stripe;
};

export const createStripeCheckoutSession = async ({
  amountMinor,
  connectedAccountId,
  contributionId,
  perspectiveId,
  returnUrl,
}: {
  amountMinor: number;
  connectedAccountId?: string | null;
  contributionId: string;
  perspectiveId: string;
  returnUrl: string;
}) => {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(
    {
      client_reference_id: contributionId,
      line_items: [
        {
          price_data: {
            currency: SUPPORT_CURRENCY.toLowerCase(),
            product_data: {
              name: "Story support",
              description: "Support this story on PXL8.",
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      metadata: {
        contributionId,
        perspectiveId,
      },
      mode: "payment",
      payment_intent_data: {
        description: "PXL8 — Story support",
        metadata: {
          contributionId,
          perspectiveId,
        },
      },
      return_url: returnUrl,
      ui_mode: "elements",
    },
    {
      idempotencyKey: contributionId,
      ...(connectedAccountId ? { stripeAccount: connectedAccountId } : {}),
    },
  );
  if (!session.client_secret) {
    throw new Error("Stripe did not return a Checkout client secret.");
  }
  return session;
};

export const retrieveStripeCheckoutSession = (
  sessionId: string,
  connectedAccountId?: string | null,
) =>
  getStripeClient().checkout.sessions.retrieve(
    sessionId,
    {},
    connectedAccountId ? { stripeAccount: connectedAccountId } : undefined,
  );

export const createStripeConnectedAccount = (creatorId: string) =>
  getStripeClient().accounts.create(
    {
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      type: "express",
      metadata: { creatorId },
    },
    { idempotencyKey: `creator-connect-${creatorId}` },
  );

export const retrieveStripeConnectedAccount = (accountId: string) =>
  getStripeClient().accounts.retrieve(accountId);

export const createStripeConnectedAccountLink = ({
  accountId,
  refreshUrl,
  returnUrl,
}: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}) =>
  getStripeClient().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

export const constructStripeWebhookEvent = ({
  payload,
  signature,
}: {
  payload: string;
  signature: string;
}) => {
  const secret = getServerEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return getStripeClient().webhooks.constructEvent(payload, signature, secret);
};

export const constructStripeConnectWebhookEvent = ({
  payload,
  signature,
}: {
  payload: string;
  signature: string;
}) => {
  const secret = getServerEnv("STRIPE_CONNECT_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET is not configured.");
  }
  return getStripeClient().webhooks.constructEvent(payload, signature, secret);
};
