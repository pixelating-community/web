import { describe, expect, it } from "vitest";
import {
  coerceSupportCount,
  formatContributionTotal,
  formatPayPalAmount,
  getSupportTier,
  SUPPORT_MAX_AMOUNT_MINOR,
  SUPPORT_MIN_AMOUNT_MINOR,
  SUPPORT_TIERS,
} from "@/lib/perspectiveSupport";
import {
  capturePayPalContributionOrderSchema,
  createPayPalContributionOrderSchema,
  createStripeContributionSessionSchema,
  reconcileStripeContributionSchema,
} from "@/lib/perspectiveSupport.schema";
import {
  resolvePayPalEnvironment,
  resolveStripeEnvironment,
} from "@/lib/paymentEnvironment";
import { resolvePaymentApplicationOrigin } from "@/lib/paymentUrls";

const PERSPECTIVE_ID = "11111111-1111-4111-8111-111111111111";

describe("perspective support", () => {
  it("normalizes database counts and formats minor currency units", () => {
    expect(coerceSupportCount("42")).toBe(42);
    expect(coerceSupportCount(-5)).toBe(0);
    expect(coerceSupportCount("not-a-number")).toBe(0);
    expect(formatPayPalAmount(1250)).toBe("12.50");
    expect(formatContributionTotal(1250, "USD")).toBe("$12.50");
  });

  it("accepts only the named story tiers", () => {
    expect(SUPPORT_TIERS).toMatchObject([
      { amountMinor: 300, name: "Three Dream", requiresShipping: false },
      {
        amountMinor: 2500,
        name: "Handwritten Copy",
        requiresShipping: true,
      },
    ]);
    expect(formatContributionTotal(SUPPORT_TIERS[0].amountMinor)).toBe("$3.00");
    expect(formatContributionTotal(SUPPORT_TIERS[1].amountMinor)).toBe("$25.00");

    for (const tier of SUPPORT_TIERS) {
      expect(
        createStripeContributionSessionSchema.safeParse({
          amountMinor: tier.amountMinor,
          perspectiveId: PERSPECTIVE_ID,
        }).success,
      ).toBe(true);
      expect(getSupportTier(tier.amountMinor)?.id).toBe(tier.id);
    }
    expect(
      createPayPalContributionOrderSchema.safeParse({
        amountMinor: SUPPORT_MAX_AMOUNT_MINOR + 1,
        perspectiveId: PERSPECTIVE_ID,
      }).success,
    ).toBe(false);
    expect(
      createStripeContributionSessionSchema.safeParse({
        amountMinor: SUPPORT_MIN_AMOUNT_MINOR + 1,
        perspectiveId: PERSPECTIVE_ID,
      }).success,
    ).toBe(false);
  });

  it("constrains provider order identifiers before interpolation into requests", () => {
    expect(
      capturePayPalContributionOrderSchema.safeParse({
        orderId: "5O190127TN364715T",
        perspectiveId: PERSPECTIVE_ID,
      }).success,
    ).toBe(true);
    expect(
      capturePayPalContributionOrderSchema.safeParse({
        orderId: "../orders/anything",
        perspectiveId: PERSPECTIVE_ID,
      }).success,
    ).toBe(false);
  });

  it("accepts only Stripe Checkout Session identifiers for reconciliation", () => {
    expect(
      reconcileStripeContributionSchema.safeParse({
        perspectiveId: PERSPECTIVE_ID,
        sessionId: "cs_test_a1B2c3D4",
      }).success,
    ).toBe(true);
    expect(
      reconcileStripeContributionSchema.safeParse({
        perspectiveId: PERSPECTIVE_ID,
        sessionId: "pi_not_a_checkout_session",
      }).success,
    ).toBe(false);
  });

  it("requires matching Stripe key modes", () => {
    expect(
      resolveStripeEnvironment({
        publishableKey: "pk_test_example",
        secretKey: "sk_test_example",
      }),
    ).toBe("sandbox");
    expect(
      resolveStripeEnvironment({
        publishableKey: "pk_live_example",
        secretKey: "sk_live_example",
      }),
    ).toBe("live");
    expect(
      resolveStripeEnvironment({
        publishableKey: "pk_live_example",
        secretKey: "sk_test_example",
      }),
    ).toBeNull();
  });

  it("rejects misspelled PayPal environments", () => {
    expect(resolvePayPalEnvironment(undefined)).toBe("sandbox");
    expect(resolvePayPalEnvironment(" LIVE ")).toBe("live");
    expect(resolvePayPalEnvironment("production")).toBeNull();
  });

  it("requires an explicit HTTPS application origin in production", () => {
    expect(
      resolvePaymentApplicationOrigin({
        configuredBaseUrl: "https://pxl8.ing/path",
        isProduction: true,
        requestUrl: "http://web:3000/p/1",
      }),
    ).toBe("https://pxl8.ing");
    expect(() =>
      resolvePaymentApplicationOrigin({
        configuredBaseUrl: undefined,
        isProduction: true,
        requestUrl: "http://web:3000/p/1",
      }),
    ).toThrow("APP_BASE_URL is required in production.");
    expect(() =>
      resolvePaymentApplicationOrigin({
        configuredBaseUrl: "http://pxl8.ing",
        isProduction: true,
        requestUrl: "http://web:3000/p/1",
      }),
    ).toThrow("APP_BASE_URL must use HTTPS in production.");
  });
});
