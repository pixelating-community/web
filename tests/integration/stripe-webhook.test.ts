import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db";

type CollectedRow = {
  status: "succeeded" | "refunded";
  amount: number;
};

const runIntegration =
  process.env.STRIPE_INTEGRATION_TESTS === "1" ||
  process.env.STRIPE_INTEGRATION_TESTS === "true";
const hasStripeKey = Boolean(process.env.STRIPE_SECRET_KEY);
const hasDbConfig =
  Boolean(process.env.POSTGRES_USER) &&
  Boolean(process.env.POSTGRES_PASSWORD) &&
  Boolean(process.env.POSTGRES_DB);

const describeIntegration =
  runIntegration && hasStripeKey && hasDbConfig ? describe : describe.skip;

const waitForCollected = async (
  chargeId: string,
  expectedStatus?: CollectedRow["status"],
  timeoutMs = 30000,
) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rows = await sql<CollectedRow[]>`
      SELECT status, amount
      FROM collected
      WHERE stripe_charge_id = ${chargeId}
      LIMIT 1;
    `;

    if (rows.length > 0) {
      if (!expectedStatus || rows[0].status === expectedStatus) {
        return rows[0];
      }
    }

    await delay(500);
  }

  throw new Error(
    `Timed out waiting for collected row${
      expectedStatus ? ` (${expectedStatus})` : ""
    } for ${chargeId}.`,
  );
};

describeIntegration("stripe webhook integration", () => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    apiVersion: "2025-12-15.clover",
  });

  let topicId = "";
  let collectionId = "";
  let perspectiveId = "";
  let chargeId = "";

  beforeAll(async () => {
    const topicName = `test-topic-${randomUUID().slice(0, 8)}`;
    const token = randomUUID();

    const [topic] = await sql<{ id: string }[]>`
      INSERT INTO topics (name, token, locked)
      VALUES (${topicName}, ${token}, false)
      RETURNING id;
    `;
    topicId = topic.id;

    const [collection] = await sql<{ id: string }[]>`
      INSERT INTO collections (name, description, total)
      VALUES (
        ${`Test Collection ${topicName}`},
        ${`Test collection for ${topicName}`},
        100
      )
      RETURNING id;
    `;
    collectionId = collection.id;

    const [perspective] = await sql<{ id: string }[]>`
      INSERT INTO perspectives (perspective, topic_id, collection_id)
      VALUES (
        ${`Test perspective ${topicName}`},
        ${topicId},
        ${collectionId}
      )
      RETURNING id;
    `;
    perspectiveId = perspective.id;
  });

  afterAll(async () => {
    if (chargeId) {
      await sql`DELETE FROM collected WHERE stripe_charge_id = ${chargeId};`;
    }

    if (perspectiveId) {
      await sql`DELETE FROM perspectives WHERE id = ${perspectiveId};`;
    }

    if (collectionId) {
      await sql`DELETE FROM collections WHERE id = ${collectionId};`;
    }

    if (topicId) {
      await sql`DELETE FROM topics WHERE id = ${topicId};`;
    }

    await sql.end();
  });

  it(
    "records charge success and refund via webhook",
    { timeout: 120000 },
    async () => {
      const intent = await stripe.paymentIntents.create({
        amount: 100,
        currency: "usd",
        payment_method: "pm_card_visa",
        payment_method_types: ["card"],
        confirm: true,
        metadata: { collectionId, perspectiveId },
      });

      const latestCharge = intent.latest_charge;
      chargeId =
        typeof latestCharge === "string"
          ? latestCharge
          : (latestCharge?.id ?? "");

      if (!chargeId) {
        throw new Error("Stripe PaymentIntent did not provide a charge id.");
      }

      const collected = await waitForCollected(chargeId, "succeeded", 45000);
      expect(collected.status).toBe("succeeded");
      expect(collected.amount).toBe(100);

      await stripe.refunds.create({ charge: chargeId });

      const refunded = await waitForCollected(chargeId, "refunded", 45000);
      expect(refunded.status).toBe("refunded");
    },
  );
});
