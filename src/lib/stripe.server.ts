import "@tanstack/react-start/server-only";
import Stripe from "stripe";
import { getServerEnv } from "@/lib/env.server";
import {
  isLivePaymentsEnabled,
  isPaymentEnvironmentAllowed,
  resolveStripeEnvironment,
} from "@/lib/paymentEnvironment";
import {
  getSupportProduct,
  SUPPORT_CURRENCY,
} from "@/lib/perspectiveSupport";

const globalCache = globalThis as typeof globalThis & {
  __pxl8Stripe?: Stripe;
  __pxl8StripeSecret?: string;
};

const getStripeSecretKey = () => getServerEnv("STRIPE_SECRET_KEY");

const isEnabled = (value: string | undefined) =>
  value ? ["1", "true", "yes"].includes(value.trim().toLowerCase()) : false;

type StripeAllowedCountry =
  Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry;

const getShippingCountries = (): StripeAllowedCountry[] => {
  const countries = (getServerEnv("SUPPORT_SHIPPING_COUNTRIES") ?? "US")
    .split(",")
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);
  if (
    countries.length === 0 ||
    countries.some((country) => !/^[A-Z]{2}$/.test(country))
  ) {
    throw new Error("SUPPORT_SHIPPING_COUNTRIES must contain ISO country codes.");
  }
  return [...new Set(countries)] as StripeAllowedCountry[];
};

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
  const product = getSupportProduct(amountMinor);
  if (!product) throw new Error("Unknown story product.");

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(
    {
      client_reference_id: contributionId,
      line_items: [
        {
          price_data: {
            currency: SUPPORT_CURRENCY.toLowerCase(),
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      metadata: {
        contributionId,
        perspectiveId,
        productId: product.id,
      },
      mode: "payment",
      payment_intent_data: {
        description: `PXL8 — ${product.name}`,
        metadata: {
          contributionId,
          perspectiveId,
          productId: product.id,
        },
      },
      return_url: returnUrl,
      shipping_address_collection: product.requiresShipping
        ? { allowed_countries: getShippingCountries() }
        : undefined,
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

export const constructStripeWebhookEvent = async ({
  payload,
  signature,
}: {
  payload: string;
  signature: string;
}) => {
  const secret = getServerEnv("STRIPE_WEBHOOK_SECRET");
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  return await getStripeClient().webhooks.constructEventAsync(
    payload,
    signature,
    secret,
  );
};

export const constructStripeConnectWebhookEvent = async ({
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
  return await getStripeClient().webhooks.constructEventAsync(
    payload,
    signature,
    secret,
  );
};
