import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));
const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("story product checkout", () => {
  it("publishes product prices, delivery timing, and refund guidance", () => {
    const products = readSource("src/lib/perspectiveSupport.ts");
    const store = readSource("src/routes/t.$topic.store.tsx");

    expect(products).toMatch(/id: "digital-story"[\s\S]*amountMinor: 2500/);
    expect(products).toContain("within 2 business days");
    expect(products).toContain("within 10 business days");
    expect(store).toContain("Fulfillment and refunds");
    expect(store).toContain("refunded in full");
  });

  it("collects a mailing address only for physical story orders", () => {
    const checkout = readSource(
      "src/components/StripeContributionCheckout.tsx",
    );
    const stripe = readSource("src/lib/stripe.server.ts");
    const paypal = readSource("src/lib/paypal.server.ts");

    expect(checkout).toMatch(
      /requiresShipping \? <ShippingAddressElement \/> : null/,
    );
    expect(stripe).toMatch(
      /shipping_address_collection: product\.requiresShipping/,
    );
    expect(paypal).toMatch(
      /shipping_preference: product\.requiresShipping/,
    );
  });

  it("binds provider line items and metadata to an advertised product", () => {
    const stripe = readSource("src/lib/stripe.server.ts");
    const support = readSource("src/lib/perspectiveSupport.server.ts");

    expect(stripe).toContain("name: product.name");
    expect(stripe).toContain("productId: product.id");
    expect(support).toContain(
      "session.metadata?.productId !== expectedProduct.id",
    );
  });

  it("verifies Stripe webhook signatures asynchronously under Bun", () => {
    const stripe = readSource("src/lib/stripe.server.ts");
    const platformRoute = readSource(
      "src/routes/api/obj/stripe-webhook.ts",
    );
    const connectRoute = readSource(
      "src/routes/api/obj/stripe-connect-webhook.ts",
    );

    expect(stripe).toContain("webhooks.constructEventAsync(");
    expect(stripe).not.toContain("webhooks.constructEvent(");
    expect(platformRoute).toContain("await constructStripeWebhookEvent(");
    expect(connectRoute).toContain(
      "await constructStripeConnectWebhookEvent(",
    );
  });
});
