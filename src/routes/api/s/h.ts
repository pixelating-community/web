import { createFileRoute } from "@tanstack/react-router";
import type { Stripe } from "stripe";
import { sql } from "@/lib/db";
import { generateHash } from "@/lib/generateHash";
import { getStripe } from "@/lib/getStripe";

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_TOLERANCE_SECONDS = 300;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HANDLED_EVENT_TYPES = new Set(["charge.succeeded", "refund.created"]);

const parsePositiveInt = (
  value: string | null | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

export const Route = createFileRoute("/api/s/h")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          console.error("stripe:webhook:missing-secret");
          return new Response("Webhook misconfigured", { status: 500 });
        }

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.startsWith("application/json")) {
          return new Response("Unsupported content type", { status: 415 });
        }

        const sig = request.headers.get("stripe-signature");
        if (!sig) return new Response("Missing signature", { status: 400 });

        const maxBodyBytes = parsePositiveInt(
          process.env.STRIPE_WEBHOOK_MAX_BODY_BYTES,
          DEFAULT_MAX_BODY_BYTES,
        );
        const contentLength = request.headers.get("content-length");
        if (contentLength) {
          const length = Number.parseInt(contentLength, 10);
          if (Number.isFinite(length) && length > maxBodyBytes) {
            return new Response("Payload too large", { status: 413 });
          }
        }

        const stripe = getStripe();
        const rawBody = Buffer.from(await request.arrayBuffer());
        if (rawBody.length > maxBodyBytes) {
          return new Response("Payload too large", { status: 413 });
        }

        let event: Stripe.Event;
        try {
          event = stripe.webhooks.constructEvent(
            rawBody,
            sig,
            webhookSecret,
            parsePositiveInt(
              process.env.STRIPE_WEBHOOK_TOLERANCE,
              DEFAULT_TOLERANCE_SECONDS,
            ),
          );
        } catch (err) {
          console.warn("stripe:webhook:signature", err);
          return new Response("Invalid signature", { status: 400 });
        }

        const expectedLivemode = process.env.STRIPE_EXPECTED_LIVEMODE;
        if (expectedLivemode === "true" || expectedLivemode === "false") {
          if (event.livemode !== (expectedLivemode === "true")) {
            console.warn("stripe:webhook:livemode-mismatch", {
              eventId: event.id,
              livemode: event.livemode,
            });
            return new Response("Bad request", { status: 400 });
          }
        }

        const expectedAccountId = process.env.STRIPE_EXPECTED_ACCOUNT_ID;
        if (expectedAccountId && event.account !== expectedAccountId) {
          console.warn("stripe:webhook:account-mismatch", {
            eventId: event.id,
            account: event.account,
          });
          return new Response("Bad request", { status: 400 });
        }

        if (!HANDLED_EVENT_TYPES.has(event.type)) {
          return Response.json({ received: true }, { status: 200 });
        }

        try {
          if (event.type === "charge.succeeded") {
            const charge = event.data.object as Stripe.Charge;
            if (!charge?.id || typeof charge.id !== "string") {
              return new Response("Bad request", { status: 400 });
            }
            const collectionId = charge.metadata?.collectionId;
            if (typeof collectionId !== "string" || !isUuid(collectionId)) {
              return new Response("Bad request", { status: 400 });
            }
            if (
              typeof charge.amount !== "number" ||
              !Number.isFinite(charge.amount) ||
              charge.amount < 0
            ) {
              return new Response("Bad request", { status: 400 });
            }
            const hash = generateHash(charge.id);

            await sql`
          INSERT INTO collected (
            collection_id,
            stripe_charge_id,
            stripe_hash,
            amount,
            status
          )
          VALUES (
            ${collectionId},
            ${charge.id},
            ${hash},
            ${charge.amount},
            'succeeded'
          )
          ON CONFLICT (stripe_hash) DO UPDATE
            SET status = 'succeeded', amount = ${charge.amount};
        `;
          } else if (event.type === "refund.created") {
            const refund = event.data.object as Stripe.Refund;
            if (!refund?.charge || typeof refund.charge !== "string") {
              return new Response("Bad request", { status: 400 });
            }
            const chargeId = refund.charge as string;
            const hash = generateHash(chargeId);
            await sql`
          UPDATE collected
          SET status = 'refunded'
          WHERE stripe_hash = ${hash};
        `;
          }
        } catch (err) {
          console.error("stripe:webhook:db-error", {
            eventId: event.id,
            error: err,
          });
          return new Response("Processing failed", { status: 500 });
        }

        return Response.json({ received: true }, { status: 200 });
      },
    },
  },
});
