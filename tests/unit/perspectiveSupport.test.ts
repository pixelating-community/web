import { describe, expect, it } from "vitest";
import {
  coerceSupportCount,
  formatContributionTotal,
  formatPayPalAmount,
  parseContributionAmount,
  SUPPORT_DEFAULT_AMOUNT_MINOR,
  SUPPORT_MIN_AMOUNT_MINOR,
} from "@/lib/perspectiveSupport";
import {
  capturePayPalContributionOrderSchema,
  createPayPalContributionOrderSchema,
  createStripeContributionSessionSchema,
  reconcileStripeContributionSchema,
} from "@/lib/perspectiveSupport.schema";
import {
  isLivePaymentsEnabled,
  isPaymentEnvironmentAllowed,
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

  it("accepts custom support amounts from one dollar without an app maximum", () => {
    expect(SUPPORT_DEFAULT_AMOUNT_MINOR).toBe(300);
    expect(SUPPORT_MIN_AMOUNT_MINOR).toBe(100);
    for (const amountMinor of [100, 300, 850, 250_000, 99_999_999]) {
      expect(
        createStripeContributionSessionSchema.safeParse({
          amountMinor,
          perspectiveId: PERSPECTIVE_ID,
        }).success,
      ).toBe(true);
    }
    expect(
      createPayPalContributionOrderSchema.safeParse({
        amountMinor: 99,
        perspectiveId: PERSPECTIVE_ID,
      }).success,
    ).toBe(false);
    expect(
      createStripeContributionSessionSchema.safeParse({
        amountMinor: 100.5,
        perspectiveId: PERSPECTIVE_ID,
      }).success,
    ).toBe(false);
  });

  it("parses decimal support input into exact minor units", () => {
    expect(parseContributionAmount("1")).toBe(100);
    expect(parseContributionAmount("3.00")).toBe(300);
    expect(parseContributionAmount("8.5")).toBe(850);
    expect(parseContributionAmount("2500")).toBe(250_000);
    expect(parseContributionAmount("0.99")).toBeNull();
    expect(parseContributionAmount("3.001")).toBeNull();
    expect(parseContributionAmount("1e3")).toBeNull();
    expect(parseContributionAmount("not money")).toBeNull();
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

  it("requires an explicit opt-in before allowing live payments", () => {
    expect(isLivePaymentsEnabled(undefined)).toBe(false);
    expect(isLivePaymentsEnabled("false")).toBe(false);
    expect(isLivePaymentsEnabled("true")).toBe(true);
    expect(
      isPaymentEnvironmentAllowed({
        environment: "sandbox",
        livePaymentsEnabled: false,
      }),
    ).toBe(true);
    expect(
      isPaymentEnvironmentAllowed({
        environment: "live",
        livePaymentsEnabled: false,
      }),
    ).toBe(false);
    expect(
      isPaymentEnvironmentAllowed({
        environment: "live",
        livePaymentsEnabled: true,
      }),
    ).toBe(true);
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
