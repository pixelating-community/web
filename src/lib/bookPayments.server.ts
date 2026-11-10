import "@tanstack/react-start/server-only";
import { randomBytes } from "node:crypto";
import type Stripe from "stripe";
import { sql } from "@/lib/db.server";
import {
  getBookReader,
  hashBookToken,
  readerCookie,
} from "@/lib/bookAccess.server";
import { getBookSettings } from "@/lib/book.server";
import { getStripeClient, getStripePublicConfig } from "@/lib/stripe.server";
import { resolvePaymentApplicationOrigin } from "@/lib/paymentUrls";
import { bookPath } from "@/lib/book";

export const bookOrigin = (request: Request) =>
  resolvePaymentApplicationOrigin({
    configuredBaseUrl: process.env.APP_BASE_URL,
    isProduction: process.env.NODE_ENV === "production",
    requestUrl: request.url,
  });
export const emailReady = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.BOOK_EMAIL_FROM);
export const bookSalesReady = () =>
  emailReady() &&
  getStripePublicConfig().enabled &&
  Boolean(process.env.STRIPE_WEBHOOK_SECRET);
export const requestBookLogin = async (email: string, request: Request) => {
  if (!emailReady()) throw new Error("Email sign-in is not configured yet.");
  const rows = await sql<{
    id: string;
  }>`INSERT INTO book_readers (email) VALUES (${email.trim().toLowerCase()}) ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id;`;
  const token = randomBytes(32).toString("base64url");
  await sql`INSERT INTO book_login_tokens (hash,reader_id,expires_at) VALUES (${hashBookToken(token)},${rows[0].id},NOW()+INTERVAL '15 minutes');`;
  const book = await getBookSettings();
  const url = new URL(`${bookPath(book.slug)}/sign-in`, bookOrigin(request));
  url.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.BOOK_EMAIL_FROM,
      to: email.trim().toLowerCase(),
      subject: `Sign in to ${book.title}`,
      text: `Sign in to read ${book.title}:\n\n${url}\n\nThis link expires in 15 minutes. If you did not request it, ignore this email.`,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    await sql`DELETE FROM book_login_tokens WHERE hash=${hashBookToken(token)};`;
    throw new Error("Could not send the sign-in email. Please try again.");
  }
};
export const consumeBookLogin = async (token: string) => {
  const session = randomBytes(32).toString("base64url");
  await sql.begin(async (tx) => {
    const rows = await tx<{
      reader_id: string;
    }>`DELETE FROM book_login_tokens WHERE hash=${hashBookToken(token)} AND expires_at>NOW() RETURNING reader_id;`;
    if (!rows[0])
      throw new Error(
        "This link expired or was already used. Request another email.",
      );
    await tx`INSERT INTO book_reader_sessions (hash,reader_id,expires_at) VALUES (${hashBookToken(session)},${rows[0].reader_id},NOW()+INTERVAL '30 days');`;
  });
  return `book_reader=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
};
export const logoutBookReader = async (request: Request) => {
  await sql`DELETE FROM book_reader_sessions WHERE hash=${hashBookToken(readerCookie(request))};`;
  return "book_reader=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
};
export const checkoutBook = async (request: Request) => {
  const reader = await getBookReader(request);
  if (!reader) throw new Error("Sign in by email before buying the book.");
  const book = await getBookSettings();
  if (!bookSalesReady() || !book.price_minor)
    throw new Error("Book sales are not available yet.");
  const purchased =
    await sql`SELECT id FROM book_orders WHERE reader_id=${reader.id} AND paid AND refunded_minor<amount_minor;`;
  if (purchased.length) throw new Error("You already own the book.");
  const orders = await sql<{
    id: string;
  }>`INSERT INTO book_orders (reader_id,amount_minor) VALUES (${reader.id},${book.price_minor}) RETURNING id;`;
  const order = orders[0];
  const base = new URL(bookPath(book.slug), bookOrigin(request)).toString();
  const session = await getStripeClient().checkout.sessions.create(
    {
      mode: "payment",
      customer_email: reader.email,
      client_reference_id: order.id,
      metadata: { purpose: "book", orderId: order.id, readerId: reader.id },
      payment_intent_data: { metadata: { purpose: "book", orderId: order.id } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: book.price_minor,
            product_data: {
              name: book.title,
              description:
                "One-time access to all paid chapters, including future chapters.",
            },
          },
        },
      ],
      success_url: `${base}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: base,
    },
    { idempotencyKey: order.id },
  );
  await sql`UPDATE book_orders SET session_id=${session.id} WHERE id=${order.id};`;
  if (!session.url) throw new Error("Stripe checkout is unavailable.");
  return session.url;
};
export const fulfillBookSession = async (
  sessionId: string,
  request?: Request,
) => {
  const reader = request ? await getBookReader(request) : null;
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
  if (session.metadata?.purpose !== "book") return;
  if (request && (!reader || reader.id !== session.metadata.readerId))
    throw new Error("This purchase belongs to another reader.");
  await sql.begin(async (tx) => {
    const rows = await tx<{
      id: string;
      reader_id: string;
      amount_minor: number;
      session_id: string | null;
    }>`SELECT id,reader_id,amount_minor,session_id FROM book_orders WHERE id=${session.metadata!.orderId} FOR UPDATE;`;
    const order = rows[0];
    if (
      !order ||
      session.client_reference_id !== order.id ||
      session.metadata?.readerId !== order.reader_id ||
      session.amount_total !== order.amount_minor ||
      session.currency !== "usd" ||
      (order.session_id && order.session_id !== session.id)
    )
      throw new Error("Payment does not match the book order.");
    if (session.payment_status !== "paid") return;
    const intent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intent) throw new Error("Missing payment intent.");
    // Retrieve the current refund total so delayed completion events cannot restore refunded access.
    const pi = await getStripeClient().paymentIntents.retrieve(intent, {
      expand: ["latest_charge"],
    });
    const charge =
      typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    await tx`UPDATE book_orders SET paid=true,session_id=${session.id},payment_intent_id=${intent},refunded_minor=GREATEST(refunded_minor,${charge?.amount_refunded ?? 0}) WHERE id=${order.id};`;
  });
};
export const processBookWebhook = async (event: Stripe.Event) => {
  if (event.account) return;
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    if (event.data.object.metadata?.purpose === "book")
      await fulfillBookSession(event.data.object.id);
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    const intent =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (intent && charge.currency === "usd")
      await sql`UPDATE book_orders SET refunded_minor=GREATEST(refunded_minor,LEAST(amount_minor,${charge.amount_refunded})) WHERE payment_intent_id=${intent};`;
  }
};
