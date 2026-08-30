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
});
