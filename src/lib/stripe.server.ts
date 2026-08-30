import "@tanstack/react-start/server-only";
import Stripe from "stripe";
import { getServerEnv } from "@/lib/env.server";
import { resolveStripeEnvironment } from "@/lib/paymentEnvironment";
import {
  getSupportTier,
  SUPPORT_CURRENCY,
} from "@/lib/perspectiveSupport";

const globalCache = globalThis as typeof globalThis & {
  __pxl8Stripe?: Stripe;
  __pxl8StripeSecret?: string;
};

const getStripeSecretKey = () => getServerEnv("STRIPE_SECRET_KEY");

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
  const webhookConfigured = Boolean(getServerEnv("STRIPE_WEBHOOK_SECRET"));
  return {
    currency: SUPPORT_CURRENCY,
    enabled: Boolean(
      environment &&
        (process.env.NODE_ENV !== "production" || webhookConfigured),
    ),
    environment: environment ?? "sandbox",
    publishableKey: publishableKey ?? null,
  };
};

export const getStripeClient = () => {
  const secretKey = getStripeSecretKey();
  if (!secretKey) throw new Error("Stripe contributions are not configured.");
  const publishableKey = getServerEnv(
    "STRIPE_PUBLISHABLE_KEY",
    "VITE_STRIPE_PUBLISHABLE_KEY",
  );
  if (!resolveStripeEnvironment({ publishableKey, secretKey })) {
    throw new Error("Stripe publishable and secret keys must use the same mode.");
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
  contributionId,
  perspectiveId,
  returnUrl,
}: {
  amountMinor: number;
  contributionId: string;
  perspectiveId: string;
  returnUrl: string;
}) => {
  const tier = getSupportTier(amountMinor);
  if (!tier) throw new Error("Unknown story support tier.");

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(
    {
      client_reference_id: contributionId,
      line_items: [
        {
          price_data: {
            currency: SUPPORT_CURRENCY.toLowerCase(),
            product_data: {
              name: tier.name,
              description: tier.description,
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        },
      ],
      metadata: {
        contributionId,
        perspectiveId,
        tierId: tier.id,
      },
      mode: "payment",
      payment_intent_data: {
        description: `PXL8 — ${tier.name}`,
        metadata: {
          contributionId,
          perspectiveId,
          tierId: tier.id,
        },
      },
      return_url: returnUrl,
      shipping_address_collection: tier.requiresShipping
        ? { allowed_countries: getShippingCountries() }
        : undefined,
      ui_mode: "elements",
    },
    { idempotencyKey: contributionId },
  );
  if (!session.client_secret) {
    throw new Error("Stripe did not return a Checkout client secret.");
  }
  return session;
};

export const retrieveStripeCheckoutSession = (sessionId: string) =>
  getStripeClient().checkout.sessions.retrieve(sessionId);

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
