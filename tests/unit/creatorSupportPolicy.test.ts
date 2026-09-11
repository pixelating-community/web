import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = fileURLToPath(new URL("../..", import.meta.url));
const readSource = (relativePath: string) =>
  readFileSync(path.join(rootDir, relativePath), "utf8");

describe("creator support policy", () => {
  it("keeps invite secrets out of storage, requests, and readable cookies", () => {
    const server = readSource("src/lib/creatorSupport.server.ts");
    const route = readSource("src/routes/t.$topic.support.claim.tsx");

    expect(server).toMatch(/createHash\("sha256"\)/);
    expect(server).toMatch(/claimUrl\.hash = `token=/);
    expect(server).toMatch(/"Path=\/"/);
    expect(server).toMatch(/"HttpOnly"/);
    expect(server).toMatch(/"SameSite=Lax"/);
    expect(route).toMatch(/window\.history\.replaceState/);
  });

  it("protects invite creation with the production administration keys", () => {
    const route = readSource("src/routes/api/obj/topic-owner-invites.ts");

    expect(route).toMatch(/process\.env\.NODE_ENV === "production"/);
    expect(route).toMatch(/process\.env\.EL_KEY/);
    expect(route).toMatch(/process\.env\.TS_KEY/);
    expect(route).toMatch(/status: 401/);
  });

  it("activates topic ownership only when the single-use invite is claimed", () => {
    const server = readSource("src/lib/creatorSupport.server.ts");
    const claimStart = server.indexOf("claimTopicOwnerInviteServer");
    const ownerInsert = server.indexOf("INSERT INTO topic_owners");

    expect(ownerInsert).toBeGreaterThan(claimStart);
  });

  it("snapshots direct-charge recipients without taking an application fee", () => {
    const support = readSource("src/lib/perspectiveSupport.server.ts");
    const stripe = readSource("src/lib/stripe.server.ts");
    const ui = readSource("src/components/PerspectiveSupport.tsx");

    expect(support).toMatch(/recipient_creator_id/);
    expect(support).toMatch(/recipient_provider_account_id/);
    expect(support).toMatch(/"stripe_direct"/);
    expect(stripe).toMatch(/stripeAccount: connectedAccountId/);
    expect(stripe).not.toMatch(/application_fee_amount/);
    expect(ui).toMatch(/!creatorSupport \|\| hasCreatorManagedCheckout/);
  });

  it("verifies connected-account events with a separate webhook secret", () => {
    const route = readSource(
      "src/routes/api/obj/stripe-connect-webhook.ts",
    );
    const stripe = readSource("src/lib/stripe.server.ts");
    const nginx = readSource("infra/nginx/pxl8.conf.example");
    const cloudflare = readSource("infra/terraform/pxl8.tf");

    expect(route).toMatch(/constructStripeConnectWebhookEvent/);
    expect(route).toMatch(/typeof event\.account !== "string"/);
    expect(stripe).toMatch(/STRIPE_CONNECT_WEBHOOK_SECRET/);
    expect(nginx).toMatch(/location = \/api\/obj\/stripe-connect-webhook/);
    expect(cloudflare).toMatch(/api\/obj\/stripe-connect-webhook/);
  });

  it("runs additive migrations non-interactively before replacing the production web service", () => {
    const workflow = readSource(".github/workflows/ci.yml");
    const migration = workflow.indexOf(
      "run --rm --no-deps --interactive=false -T web bun run migrate",
    );
    const restart = workflow.indexOf("--force-recreate web");

    expect(migration).toBeGreaterThan(-1);
    expect(restart).toBeGreaterThan(migration);
  });
});
