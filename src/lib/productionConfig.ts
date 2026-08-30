import {
  resolvePayPalEnvironment,
  resolveStripeEnvironment,
} from "@/lib/paymentEnvironment";

type Environment = Record<string, string | undefined>;

export type ProductionConfigCheck = {
  errors: string[];
  warnings: string[];
  paymentProviders: Array<"paypal" | "stripe">;
};
const value = (environment: Environment, key: string) =>
  environment[key]?.trim() || undefined;

const hasAll = (environment: Environment, keys: string[]) =>
  keys.every((key) => Boolean(value(environment, key)));

export const checkProductionConfig = (
  environment: Environment,
): ProductionConfigCheck => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const paymentProviders: Array<"paypal" | "stripe"> = [];

  const appBaseUrl = value(environment, "APP_BASE_URL");
  if (!appBaseUrl) {
    errors.push("APP_BASE_URL is required");
  } else {
    try {
      if (new URL(appBaseUrl).protocol !== "https:") {
        errors.push("APP_BASE_URL must use HTTPS");
      }
    } catch {
      errors.push("APP_BASE_URL must be a valid URL");
    }
  }

  for (const key of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "BUCKET_NAME",
  ]) {
    if (!value(environment, key)) errors.push(`${key} is required`);
  }

  if (
    !value(environment, "ACTION_TOKEN_SECRET") &&
    !value(environment, "REFLECTION_ACCESS_SECRET") &&
    !value(environment, "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY")
  ) {
    errors.push("ACTION_TOKEN_SECRET is required");
  }

  const stripePublishableKey =
    value(environment, "STRIPE_PUBLISHABLE_KEY") ??
    value(environment, "VITE_STRIPE_PUBLISHABLE_KEY");
  const stripeSecretKey = value(environment, "STRIPE_SECRET_KEY");
  const stripeHasAny = Boolean(
    stripePublishableKey ||
      stripeSecretKey ||
      value(environment, "STRIPE_WEBHOOK_SECRET"),
  );
  const stripeEnvironment = resolveStripeEnvironment({
    publishableKey: stripePublishableKey,
    secretKey: stripeSecretKey,
  });
  const stripeComplete = Boolean(
    stripeEnvironment && value(environment, "STRIPE_WEBHOOK_SECRET"),
  );
  if (stripeComplete) paymentProviders.push("stripe");
  else if (stripeHasAny) {
    warnings.push(
      "Stripe is partially configured or its publishable and secret keys use different modes",
    );
  }

  const paypalKeys = [
    "PAYPAL_CLIENT_ID",
    "PAYPAL_CLIENT_SECRET",
    "PAYPAL_WEBHOOK_ID",
  ];
  const paypalHasAny = paypalKeys.some((key) => Boolean(value(environment, key)));
  const paypalEnvironment = resolvePayPalEnvironment(
    value(environment, "PAYPAL_ENVIRONMENT"),
  );
  const paypalComplete =
    hasAll(environment, paypalKeys) && Boolean(paypalEnvironment);
  if (paypalComplete) paymentProviders.push("paypal");
  else if (paypalHasAny) {
    warnings.push(
      "PayPal is partially configured or PAYPAL_ENVIRONMENT is invalid",
    );
  }

  if (paymentProviders.length === 0) {
    errors.push("At least one payment provider must be fully configured");
  }

  if (!value(environment, "TS_KEY") && !value(environment, "EL_KEY")) {
    warnings.push("TS_KEY or EL_KEY is recommended for production topic administration");
  }

  return { errors, warnings, paymentProviders };
};

export const assertProductionConfig = (environment: Environment) => {
  if (value(environment, "NODE_ENV") !== "production") return;

  const result = checkProductionConfig(environment);
  for (const warning of result.warnings) {
    console.warn(`[config] ${warning}`);
  }
  if (result.errors.length > 0) {
    throw new Error(
      `Invalid production configuration: ${result.errors.join("; ")}`,
    );
  }
  console.log(
    `[config] production configuration valid; payments=${result.paymentProviders.join(",")}`,
  );
};
