import { describe, expect, it } from "vitest";
import { checkProductionConfig } from "@/lib/productionConfig";

const baseEnvironment = {
  ACTION_TOKEN_SECRET: "action-secret",
  APP_BASE_URL: "https://pxl8.ing",
  BUCKET_NAME: "pxl8",
  R2_ACCESS_KEY_ID: "access-key",
  R2_ACCOUNT_ID: "account-id",
  R2_SECRET_ACCESS_KEY: "secret-key",
};

describe("production configuration", () => {
  it("accepts a complete Stripe sandbox configuration", () => {
    const result = checkProductionConfig({
      ...baseEnvironment,
      STRIPE_PUBLISHABLE_KEY: "pk_test_example",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });

    expect(result.errors).toEqual([]);
    expect(result.paymentProviders).toEqual(["stripe"]);
  });

  it("accepts a complete PayPal sandbox configuration", () => {
    const result = checkProductionConfig({
      ...baseEnvironment,
      PAYPAL_CLIENT_ID: "client-id",
      PAYPAL_CLIENT_SECRET: "client-secret",
      PAYPAL_ENVIRONMENT: "sandbox",
      PAYPAL_WEBHOOK_ID: "webhook-id",
    });

    expect(result.errors).toEqual([]);
    expect(result.paymentProviders).toEqual(["paypal"]);
  });

  it("reports missing launch-critical configuration without exposing values", () => {
    const result = checkProductionConfig({ APP_BASE_URL: "http://pxl8.ing" });

    expect(result.errors).toContain("APP_BASE_URL must use HTTPS");
    expect(result.errors).toContain("R2_ACCOUNT_ID is required");
    expect(result.errors).toContain("ACTION_TOKEN_SECRET is required");
    expect(result.errors).toContain(
      "At least one payment provider must be fully configured",
    );
    expect(result.errors.join(" ")).not.toContain("http://pxl8.ing");
  });

  it("rejects mismatched Stripe key modes when no other provider is ready", () => {
    const result = checkProductionConfig({
      ...baseEnvironment,
      STRIPE_PUBLISHABLE_KEY: "pk_test_example",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });

    expect(result.paymentProviders).toEqual([]);
    expect(result.errors).toContain(
      "At least one payment provider must be fully configured",
    );
  });

  it("does not activate live credentials without an explicit opt-in", () => {
    const disabled = checkProductionConfig({
      ...baseEnvironment,
      STRIPE_PUBLISHABLE_KEY: "pk_live_example",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });
    expect(disabled.paymentProviders).toEqual([]);
    expect(disabled.warnings).toContain(
      "Live payment credentials are disabled until PAYMENTS_LIVE_ENABLED=true",
    );

    const enabled = checkProductionConfig({
      ...baseEnvironment,
      PAYMENTS_LIVE_ENABLED: "true",
      STRIPE_PUBLISHABLE_KEY: "pk_live_example",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });
    expect(enabled.errors).toEqual([]);
    expect(enabled.paymentProviders).toEqual(["stripe"]);
  });

  it("keeps live Stripe Connect gated on explicit approval", () => {
    const result = checkProductionConfig({
      ...baseEnvironment,
      PAYMENTS_LIVE_ENABLED: "true",
      STRIPE_CONNECT_ENABLED: "true",
      STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect_example",
      STRIPE_PUBLISHABLE_KEY: "pk_live_example",
      STRIPE_SECRET_KEY: "sk_live_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });

    expect(result.errors).toContain(
      "Live Stripe Connect requires STRIPE_CONNECT_APPROVED=true",
    );
  });

  it("allows Stripe Connect in sandbox without a live approval flag", () => {
    const result = checkProductionConfig({
      ...baseEnvironment,
      STRIPE_CONNECT_ENABLED: "true",
      STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect_example",
      STRIPE_PUBLISHABLE_KEY: "pk_test_example",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });

    expect(result.errors).toEqual([]);
  });

  it("requires a separate connected-account webhook secret", () => {
    const result = checkProductionConfig({
      ...baseEnvironment,
      STRIPE_CONNECT_ENABLED: "true",
      STRIPE_PUBLISHABLE_KEY: "pk_test_example",
      STRIPE_SECRET_KEY: "sk_test_example",
      STRIPE_WEBHOOK_SECRET: "whsec_example",
    });

    expect(result.errors).toContain(
      "STRIPE_CONNECT_ENABLED requires STRIPE_CONNECT_WEBHOOK_SECRET",
    );
  });
});
