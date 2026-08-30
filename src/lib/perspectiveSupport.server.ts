import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import { getServerEnv } from "@/lib/env.server";
import { resolvePaymentApplicationOrigin } from "@/lib/paymentUrls";
import {
  getPayPalOrder,
  getPayPalPublicConfig,
  PayPalRequestError,
  capturePayPalOrder,
  createPayPalOrder,
  readCompletedPayPalCapture,
} from "@/lib/paypal.server";
import {
  coerceSupportCount,
  getSupportTier,
  SUPPORT_CURRENCY,
  SUPPORT_MAX_AMOUNT_MINOR,
  SUPPORT_MIN_AMOUNT_MINOR,
  type PerspectiveSupportStats,
} from "@/lib/perspectiveSupport";
import {
  capturePayPalContributionOrderSchema,
  castPerspectiveVoteSchema,
  createPayPalContributionOrderSchema,
  createStripeContributionSessionSchema,
  loadPerspectiveSupportSchema,
  reconcileStripeContributionSchema,
} from "@/lib/perspectiveSupport.schema";
import {
  createVoterIdentity,
  getVoterHashFromRequest,
} from "@/lib/perspectiveSupportIdentity.server";
import {
  createStripeCheckoutSession,
  getStripePublicConfig,
  retrieveStripeCheckoutSession,
} from "@/lib/stripe.server";

type ContributionRow = {
  amount_minor: number | string;
  currency: string;
  id: string;
  perspective_id: string;
  provider_capture_id: string | null;
  provider_order_id: string | null;
  refunded_minor: number | string;
  status: string;
};

type SupportSqlClient = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

const perspectiveAcceptsSupport = async (perspectiveId: string) => {
  const rows = await sql<{ id: string }>`
    SELECT p.id
    FROM perspectives p
    WHERE p.id = ${perspectiveId}
    LIMIT 1;
  `;
  return Boolean(rows[0]?.id);
};

export const getPerspectiveSupportStats = async ({
  perspectiveId,
  request,
}: {
  perspectiveId: string;
  request?: Request;
}): Promise<PerspectiveSupportStats | null> => {
  const voterHash = request ? getVoterHashFromRequest(request) : null;
  const rows = await sql<{
    contribution_total_minor: number | string;
    has_voted: boolean;
    id: string;
    virtual_vote_count: number | string;
  }>`
    SELECT
      p.id,
      (SELECT count(*) FROM perspective_votes v
        WHERE v.perspective_id = p.id) AS virtual_vote_count,
      (SELECT COALESCE(sum(GREATEST(c.amount_minor - c.refunded_minor, 0)), 0)
        FROM perspective_contributions c
        WHERE c.perspective_id = p.id
          AND c.status IN ('completed', 'refunded')) AS contribution_total_minor,
      CASE
        WHEN ${voterHash}::text IS NULL THEN FALSE
        ELSE EXISTS (
          SELECT 1 FROM perspective_votes viewer_vote
          WHERE viewer_vote.perspective_id = p.id
            AND viewer_vote.voter_hash = ${voterHash}
        )
      END AS has_voted
    FROM perspectives p
    WHERE p.id = ${perspectiveId}
    LIMIT 1;
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    contributionCurrency: SUPPORT_CURRENCY,
    contributionTotalMinor: coerceSupportCount(row.contribution_total_minor),
    hasVoted: Boolean(row.has_voted),
    virtualVoteCount: coerceSupportCount(row.virtual_vote_count),
  };
};

export const loadPerspectiveSupportServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof loadPerspectiveSupportSchema>;
  request: Request;
}) => {
  const stats = await getPerspectiveSupportStats({
    perspectiveId: data.perspectiveId,
    request,
  });
  if (!stats) {
    return { ok: false as const, error: "Perspective not found." };
  }
  return {
    ok: true as const,
    data: {
      ...stats,
      maxAmountMinor: SUPPORT_MAX_AMOUNT_MINOR,
      minAmountMinor: SUPPORT_MIN_AMOUNT_MINOR,
      providers: {
        paypal: getPayPalPublicConfig(),
        stripe: getStripePublicConfig(),
      },
    },
  };
};

export const castPerspectiveVoteServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof castPerspectiveVoteSchema>;
  request: Request;
}) => {
  if (!(await perspectiveAcceptsSupport(data.perspectiveId))) {
    return { ok: false as const, error: "Perspective not found." };
  }

  const existingHash = getVoterHashFromRequest(request);
  const identity = existingHash
    ? { voterHash: existingHash, token: null }
    : createVoterIdentity();
  const inserted = await sql<{ id: string }>`
    INSERT INTO perspective_votes (perspective_id, voter_hash)
    VALUES (${data.perspectiveId}, ${identity.voterHash})
    ON CONFLICT (perspective_id, voter_hash) DO NOTHING
    RETURNING id;
  `;
  const stats = await getPerspectiveSupportStats({
    perspectiveId: data.perspectiveId,
    request,
  });
  if (!stats) {
    return { ok: false as const, error: "Perspective not found." };
  }

  return {
    ok: true as const,
    data: {
      ...stats,
      hasVoted: true,
      virtualVoteCount: stats.virtualVoteCount,
      voteAdded: inserted.length > 0,
    },
    voterToken: identity.token,
  };
};

export const createPayPalContributionOrderServer = async ({
  data,
}: {
  data: z.infer<typeof createPayPalContributionOrderSchema>;
}) => {
  if (!(await perspectiveAcceptsSupport(data.perspectiveId))) {
    return { ok: false as const, error: "Perspective not found." };
  }

  const contributionId = randomUUID();
  await sql`
    INSERT INTO perspective_contributions (
      id,
      perspective_id,
      provider,
      amount_minor,
      currency,
      status
    ) VALUES (
      ${contributionId},
      ${data.perspectiveId},
      'paypal',
      ${data.amountMinor},
      ${SUPPORT_CURRENCY},
      'initializing'
    );
  `;

  try {
    const orderId = await createPayPalOrder({
      amountMinor: data.amountMinor,
      contributionId,
    });
    await sql`
      UPDATE perspective_contributions
      SET provider_order_id = ${orderId},
          status = 'created',
          updated_at = NOW()
      WHERE id = ${contributionId};
    `;
    return { ok: true as const, data: { orderId } };
  } catch (error) {
    await sql`
      UPDATE perspective_contributions
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${contributionId};
    `;
    console.error("Failed to create PayPal contribution order", {
      contributionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false as const,
      error: "Could not start PayPal checkout. Please try again.",
    };
  }
};

const resolveStripeReturnUrl = ({
  perspectiveId,
  request,
}: {
  perspectiveId: string;
  request: Request;
}) => {
  const baseOrigin = resolvePaymentApplicationOrigin({
    configuredBaseUrl: getServerEnv("APP_BASE_URL"),
    isProduction: process.env.NODE_ENV === "production",
    requestUrl: request.url,
  });
  const returnUrl = new URL(
    `/p/${encodeURIComponent(perspectiveId)}`,
    baseOrigin,
  );
  return `${returnUrl.toString()}?stripe_session_id={CHECKOUT_SESSION_ID}`;
};

export const createStripeContributionSessionServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof createStripeContributionSessionSchema>;
  request: Request;
}) => {
  if (!(await perspectiveAcceptsSupport(data.perspectiveId))) {
    return { ok: false as const, error: "Perspective not found." };
  }

  const contributionId = randomUUID();
  await sql`
    INSERT INTO perspective_contributions (
      id,
      perspective_id,
      provider,
      amount_minor,
      currency,
      status
    ) VALUES (
      ${contributionId},
      ${data.perspectiveId},
      'stripe',
      ${data.amountMinor},
      ${SUPPORT_CURRENCY},
      'initializing'
    );
  `;

  const returnUrl = resolveStripeReturnUrl({
    perspectiveId: data.perspectiveId,
    request,
  });
  try {
    const session = await createStripeCheckoutSession({
      amountMinor: data.amountMinor,
      contributionId,
      perspectiveId: data.perspectiveId,
      returnUrl,
    });
    await sql`
      UPDATE perspective_contributions
      SET provider_order_id = ${session.id},
          status = 'created',
          updated_at = NOW()
      WHERE id = ${contributionId};
    `;
    return {
      ok: true as const,
      data: {
        clientSecret: session.client_secret as string,
        returnUrl,
        sessionId: session.id,
      },
    };
  } catch (error) {
    await sql`
      UPDATE perspective_contributions
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${contributionId};
    `;
    console.error("Failed to create Stripe contribution session", {
      contributionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false as const,
      error: "Could not start secure checkout. Please try again.",
    };
  }
};

const getStripePaymentIntentId = (session: Stripe.Checkout.Session) => {
  const intent = session.payment_intent;
  if (typeof intent === "string") return intent;
  return intent?.id ?? null;
};

const settleStripeSession = async (
  tx: SupportSqlClient,
  session: Stripe.Checkout.Session,
) => {
  const rows = await tx<ContributionRow>`
    SELECT id, perspective_id, amount_minor, refunded_minor, currency,
      provider_order_id, provider_capture_id, status
    FROM perspective_contributions
    WHERE provider = 'stripe' AND provider_order_id = ${session.id}
    LIMIT 1
    FOR UPDATE;
  `;
  const contribution = rows[0];
  if (!contribution) return null;

  const expectedAmount = coerceSupportCount(contribution.amount_minor);
  const expectedTier = getSupportTier(expectedAmount);
  const receivedCurrency = session.currency?.toUpperCase();
  if (
    !expectedTier ||
    session.client_reference_id !== contribution.id ||
    session.metadata?.contributionId !== contribution.id ||
    session.metadata?.perspectiveId !== contribution.perspective_id ||
    session.metadata?.tierId !== expectedTier.id ||
    session.amount_total !== expectedAmount ||
    receivedCurrency !== contribution.currency
  ) {
    throw new Error("Stripe Checkout Session did not match its ledger entry.");
  }

  const paid = session.payment_status === "paid";
  if (paid) {
    const paymentIntentId = getStripePaymentIntentId(session);
    if (!paymentIntentId) {
      throw new Error("Paid Stripe Checkout Session is missing a Payment Intent.");
    }
    await tx`
      UPDATE perspective_contributions
      SET status = 'completed',
          provider_capture_id = ${paymentIntentId},
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW()
      WHERE id = ${contribution.id};
    `;
  }
  return {
    paid,
    perspectiveId: contribution.perspective_id,
  };
};

export const reconcileStripeContributionServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof reconcileStripeContributionSchema>;
  request: Request;
}) => {
  const rows = await sql<{ id: string }>`
    SELECT id
    FROM perspective_contributions
    WHERE provider = 'stripe'
      AND perspective_id = ${data.perspectiveId}
      AND provider_order_id = ${data.sessionId}
    LIMIT 1;
  `;
  if (rows.length === 0) {
    return { ok: false as const, error: "Contribution session not found." };
  }

  try {
    const session = await retrieveStripeCheckoutSession(data.sessionId);
    const settlement = await sql.begin((tx) => settleStripeSession(tx, session));
    if (!settlement) {
      return { ok: false as const, error: "Contribution session not found." };
    }
    const stats = await getPerspectiveSupportStats({
      perspectiveId: data.perspectiveId,
      request,
    });
    return {
      ok: true as const,
      data: {
        pending: !settlement.paid,
        stats,
      },
    };
  } catch (error) {
    console.error("Failed to reconcile Stripe contribution", {
      sessionId: data.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false as const,
      error: "Could not verify the contribution yet. Please try again.",
    };
  }
};

const markStripeSessionFailed = (
  tx: SupportSqlClient,
  session: Stripe.Checkout.Session,
) => tx`
  UPDATE perspective_contributions
  SET status = 'failed', updated_at = NOW()
  WHERE provider = 'stripe'
    AND provider_order_id = ${session.id}
    AND status IN ('initializing', 'created', 'capturing');
`;

const refundStripeCharge = async (
  tx: SupportSqlClient,
  charge: Stripe.Charge,
) => {
  const paymentIntent = charge.payment_intent;
  const paymentIntentId =
    typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  if (!paymentIntentId) {
    throw new Error("Refunded Stripe charge is missing a Payment Intent.");
  }

  const rows = await tx<ContributionRow>`
    SELECT id, perspective_id, amount_minor, refunded_minor, currency,
      provider_order_id, provider_capture_id, status
    FROM perspective_contributions
    WHERE provider = 'stripe' AND provider_capture_id = ${paymentIntentId}
    LIMIT 1
    FOR UPDATE;
  `;
  const contribution = rows[0];
  if (!contribution) return;
  if (charge.currency.toUpperCase() !== contribution.currency) {
    throw new Error("Stripe refund currency did not match its ledger entry.");
  }

  const originalAmount = coerceSupportCount(contribution.amount_minor);
  const refundedAmount = Math.min(
    originalAmount,
    coerceSupportCount(charge.amount_refunded),
  );
  await tx`
    UPDATE perspective_contributions
    SET refunded_minor = ${refundedAmount},
        status = ${refundedAmount >= originalAmount ? "refunded" : "completed"},
        updated_at = NOW()
    WHERE id = ${contribution.id};
  `;
};

export const processStripeWebhookServer = async (event: Stripe.Event) => {
  if (!event.id || event.id.length > 128 || !event.type) {
    throw new Error("Invalid Stripe webhook event.");
  }

  return sql.begin(async (tx) => {
    const inserted = await tx<{ event_id: string }>`
      INSERT INTO payment_webhook_events (provider, event_id, event_type)
      VALUES ('stripe', ${event.id}, ${event.type})
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING event_id;
    `;
    if (inserted.length === 0) return { duplicate: true };

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await settleStripeSession(tx, event.data.object);
        break;
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired":
        await markStripeSessionFailed(tx, event.data.object);
        break;
      case "charge.refunded":
        await refundStripeCharge(tx, event.data.object);
        break;
      case "payment_intent.payment_failed": {
        const contributionId = event.data.object.metadata.contributionId;
        if (contributionId) {
          await tx`
            UPDATE perspective_contributions
            SET status = 'failed', updated_at = NOW()
            WHERE provider = 'stripe'
              AND id = ${contributionId}
              AND status IN ('initializing', 'created', 'capturing');
          `;
        }
        break;
      }
      default:
        break;
    }

    return { duplicate: false };
  });
};

const findContribution = async (perspectiveId: string, orderId: string) => {
  const rows = await sql<ContributionRow>`
    SELECT id, amount_minor, currency, provider_capture_id, status
    FROM perspective_contributions
    WHERE perspective_id = ${perspectiveId}
      AND provider = 'paypal'
      AND provider_order_id = ${orderId}
    LIMIT 1;
  `;
  return rows[0] ?? null;
};

const markContributionReadyToRetry = (id: string) => sql`
  UPDATE perspective_contributions
  SET status = 'created', updated_at = NOW()
  WHERE id = ${id} AND status = 'capturing';
`;

export const capturePayPalContributionOrderServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof capturePayPalContributionOrderSchema>;
  request: Request;
}) => {
  const existing = await findContribution(data.perspectiveId, data.orderId);
  if (!existing) {
    return { ok: false as const, error: "Contribution order not found." };
  }
  if (existing.status === "completed") {
    const stats = await getPerspectiveSupportStats({
      perspectiveId: data.perspectiveId,
      request,
    });
    return { ok: true as const, data: stats };
  }
  if (existing.status !== "created") {
    return {
      ok: false as const,
      error:
        existing.status === "capturing"
          ? "This contribution is still processing."
          : "This contribution cannot be captured.",
    };
  }

  const claimed = await sql<{ id: string }>`
    UPDATE perspective_contributions
    SET status = 'capturing', updated_at = NOW()
    WHERE id = ${existing.id} AND status = 'created'
    RETURNING id;
  `;
  if (claimed.length === 0) {
    return { ok: false as const, error: "This contribution is still processing." };
  }

  let order;
  let captureIssue: string | undefined;
  try {
    order = await capturePayPalOrder(
      data.orderId,
      `${existing.id.replaceAll("-", "")}c`,
    );
  } catch (captureError) {
    captureIssue =
      captureError instanceof PayPalRequestError
        ? captureError.issue
        : undefined;
    try {
      order = await getPayPalOrder(data.orderId);
    } catch {
      await markContributionReadyToRetry(existing.id);
      return {
        ok: false as const,
        code: captureIssue,
        error:
          captureIssue === "INSTRUMENT_DECLINED"
            ? "PayPal declined that funding source."
            : "PayPal could not complete the contribution. Please try again.",
      };
    }
  }

  const capture = readCompletedPayPalCapture(order);
  const expectedAmount = coerceSupportCount(existing.amount_minor);
  if (!capture && captureIssue === "INSTRUMENT_DECLINED") {
    await markContributionReadyToRetry(existing.id);
    return {
      ok: false as const,
      code: captureIssue,
      error: "PayPal declined that funding source.",
    };
  }
  if (
    !capture ||
    capture.amountMinor !== expectedAmount ||
    capture.currency !== existing.currency
  ) {
    await markContributionReadyToRetry(existing.id);
    console.error("PayPal contribution capture did not match its ledger entry", {
      contributionId: existing.id,
      expectedAmount,
      expectedCurrency: existing.currency,
      receivedAmount: capture?.amountMinor,
      receivedCurrency: capture?.currency,
    });
    return {
      ok: false as const,
      error: "PayPal returned an unexpected contribution result.",
    };
  }

  await sql`
    UPDATE perspective_contributions
    SET status = 'completed',
        provider_capture_id = ${capture.captureId},
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${existing.id}
      AND status = 'capturing';
  `;
  const stats = await getPerspectiveSupportStats({
    perspectiveId: data.perspectiveId,
    request,
  });
  return { ok: true as const, data: stats };
};

type PayPalWebhookEvent = {
  event_type?: string;
  id?: string;
  resource?: {
    amount?: { currency_code?: string; value?: string };
    id?: string;
    status?: string;
    supplementary_data?: {
      related_ids?: { capture_id?: string; order_id?: string };
    };
  };
};

const readWebhookAmount = (event: PayPalWebhookEvent) => {
  const value = event.resource?.amount?.value;
  const currency = event.resource?.amount?.currency_code;
  if (!value || !currency) return null;
  const amountMinor = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return null;
  return { amountMinor, currency };
};

export const processPayPalWebhookServer = async (event: unknown) => {
  const parsed = event as PayPalWebhookEvent;
  const eventId = parsed.id?.trim();
  const eventType = parsed.event_type?.trim();
  if (!eventId || eventId.length > 128 || !eventType || eventType.length > 128) {
    throw new Error("Invalid PayPal webhook event.");
  }

  return sql.begin(async (tx) => {
    const inserted = await tx<{ event_id: string }>`
      INSERT INTO payment_webhook_events (provider, event_id, event_type)
      VALUES ('paypal', ${eventId}, ${eventType})
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING event_id;
    `;
    if (inserted.length === 0) return { duplicate: true };

    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = parsed.resource?.supplementary_data?.related_ids?.order_id;
      const captureId = parsed.resource?.id;
      const amount = readWebhookAmount(parsed);
      if (!orderId || !captureId || !amount) {
        throw new Error("Incomplete PayPal capture webhook.");
      }
      const rows = await tx<ContributionRow>`
        SELECT id, amount_minor, currency, provider_capture_id, status
        FROM perspective_contributions
        WHERE provider = 'paypal' AND provider_order_id = ${orderId}
        LIMIT 1
        FOR UPDATE;
      `;
      const contribution = rows[0];
      if (!contribution) return { duplicate: false };
      if (
        coerceSupportCount(contribution.amount_minor) !== amount.amountMinor ||
        contribution.currency !== amount.currency
      ) {
        throw new Error("PayPal capture webhook amount mismatch.");
      }
      await tx`
        UPDATE perspective_contributions
        SET status = 'completed',
            provider_capture_id = ${captureId},
            completed_at = COALESCE(completed_at, NOW()),
            updated_at = NOW()
        WHERE id = ${contribution.id};
      `;
      return { duplicate: false };
    }

    if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      const captureId =
        parsed.resource?.supplementary_data?.related_ids?.capture_id;
      const amount = readWebhookAmount(parsed);
      if (!captureId || !amount) {
        throw new Error("Incomplete PayPal refund webhook.");
      }
      const rows = await tx<ContributionRow & { refunded_minor: number | string }>`
        SELECT id, amount_minor, refunded_minor, currency, provider_capture_id, status
        FROM perspective_contributions
        WHERE provider = 'paypal' AND provider_capture_id = ${captureId}
        LIMIT 1
        FOR UPDATE;
      `;
      const contribution = rows[0];
      if (!contribution) return { duplicate: false };
      if (contribution.currency !== amount.currency) {
        throw new Error("PayPal refund webhook currency mismatch.");
      }
      const originalAmount = coerceSupportCount(contribution.amount_minor);
      const refundedAmount = Math.min(
        originalAmount,
        coerceSupportCount(contribution.refunded_minor) + amount.amountMinor,
      );
      await tx`
        UPDATE perspective_contributions
        SET refunded_minor = ${refundedAmount},
            status = ${refundedAmount >= originalAmount ? "refunded" : "completed"},
            updated_at = NOW()
        WHERE id = ${contribution.id};
      `;
    }

    return { duplicate: false };
  });
};
