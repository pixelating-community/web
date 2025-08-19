import { type NextRequest, NextResponse } from "next/server";
import type { Stripe } from "stripe";
import { sql } from "@/lib/db";
import { getStripe } from "@/lib/getStripe";

export const runtime = "nodejs";

export const POST = async (req: NextRequest) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const stripe = getStripe();
  const rawBody = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "charge.succeeded") {
      const charge = event.data.object;
      const collectionId = charge.metadata.collectionId;
      const amount = charge.amount;

      await sql`
      INSERT INTO collected (collection_id, stripe_charge_id, amount, status)
      VALUES (${collectionId}, ${charge.id}, ${amount}, 'succeeded')
      ON CONFLICT (stripe_charge_id) DO UPDATE
        SET status = 'succeeded', amount = ${amount};
    `;
    } else if (event.type === "refund.created") {
      const refund = event.data.object;
      const id = refund.charge as string;
      await sql`
        UPDATE collected
        SET status = 'refunded'
        WHERE stripe_charge_id = ${id};
      `;
    }
  } catch (err) {
    console.error("stripe:error:", err);
  }

  return NextResponse.json({ received: true }, { status: 200 });
};
