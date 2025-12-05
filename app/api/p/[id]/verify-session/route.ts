import { cookies } from "next/headers";
import type { Stripe } from "stripe";
import { z } from "zod/v4";
import { sql } from "@/lib/db";
import { getStripe } from "@/lib/getStripe";
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rateLimit";
import {
  createReflectionAccessToken,
  createReflectionWriteToken,
  getReflectionWriteCookieName,
} from "@/lib/reflectionAccess";

export const runtime = "nodejs";

const MAX_AGE_SECONDS = 36 * 60 * 60;

const schema = z.object({
  id: z.uuid(),
  sessionId: z.string().regex(/^cs_(test|live)_[a-zA-Z0-9]+$/),
});

const getChargeIdFromSession = async (
  stripe: Stripe,
  session: Stripe.Checkout.Session,
) => {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) return null;
  if (typeof paymentIntent !== "string") {
    return typeof paymentIntent.latest_charge === "string"
      ? paymentIntent.latest_charge
      : null;
  }
  const intent = await stripe.paymentIntents.retrieve(paymentIntent);
  return typeof intent.latest_charge === "string" ? intent.latest_charge : null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = getClientIp(request.headers);
  const rate = rateLimit(`verify-session:${ip}:${id}`, 10, 10 * 60 * 1000);
  const headers = rateLimitHeaders(rate);
  if (!rate.ok) {
    return Response.json(
      { error: "Too many attempts" },
      { status: 429, headers },
    );
  }

  let payload: { sessionId: string };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
  }

  let data: { id: string; sessionId: string };
  try {
    data = schema.parse({ id, sessionId: payload.sessionId });
  } catch {
    return Response.json({ error: "Invalid input" }, { status: 400, headers });
  }

  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(data.sessionId, {
      expand: ["payment_intent"],
    });
  } catch {
    return Response.json(
      { error: "Unknown session" },
      { status: 404, headers },
    );
  }

  if (session.payment_status !== "paid") {
    return Response.json({ verified: false }, { status: 401, headers });
  }

  if (session.metadata?.perspectiveId !== data.id) {
    return Response.json({ verified: false }, { status: 401, headers });
  }

  const chargeId = await getChargeIdFromSession(stripe, session);
  if (!chargeId) {
    return Response.json(
      { error: "Charge not ready" },
      { status: 409, headers },
    );
  }

  const rows = await sql`
    SELECT status
    FROM collected c
    JOIN perspectives p ON p.collection_id = c.collection_id
    WHERE c.stripe_charge_id = ${chargeId}
      AND p.id = ${data.id}
    LIMIT 1;
  `;

  if (rows.length === 0 || rows[0].status !== "succeeded") {
    return Response.json({ verified: false }, { status: 401, headers });
  }

  const token = createReflectionAccessToken(data.id);
  const writeToken = createReflectionWriteToken(data.id, chargeId);
  if (!token || !writeToken) {
    return Response.json(
      { error: "Missing access secret" },
      { status: 500, headers },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: `p_${data.id}`,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });
  cookieStore.set({
    name: getReflectionWriteCookieName(data.id),
    value: writeToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE_SECONDS,
    path: "/",
  });

  return Response.json({ verified: true }, { headers });
}
