import "@tanstack/react-start/server-only";
import { createHash, randomBytes } from "node:crypto";
import type { z } from "zod/v4";
import { sql } from "@/lib/db.server";
import { getServerEnv } from "@/lib/env.server";
import { resolvePaymentApplicationOrigin } from "@/lib/paymentUrls";
import {
  normalizePayPalMeUrl,
  normalizeVenmoBusinessUrl,
  type CreatorSupportPublic,
} from "@/lib/creatorSupport";
import type {
  claimTopicOwnerInviteSchema,
  createTopicOwnerInviteSchema,
  createStripeConnectOnboardingSchema,
  loadCreatorSupportSetupSchema,
  saveCreatorSupportMethodsSchema,
} from "@/lib/creatorSupport.schema";
import { getRequestCookie } from "@/server/lib/requestCookies";
import {
  createStripeConnectedAccount,
  createStripeConnectedAccountLink,
  getStripeConnectConfig,
  retrieveStripeConnectedAccount,
} from "@/lib/stripe.server";

const INVITE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SETUP_SESSION_MAX_AGE_SECONDS = 30 * 60;

const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

const createToken = () => randomBytes(32).toString("base64url");
const getSetupCookieName = (topicId: string) => `creator_setup_${topicId}`;

const buildSetupCookie = ({
  request,
  topicId,
  token,
}: {
  request: Request;
  topicId: string;
  token: string;
}) => {
  const parts = [
    `${getSetupCookieName(topicId)}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${SETUP_SESSION_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (
    process.env.NODE_ENV === "production" ||
    new URL(request.url).protocol === "https:"
  ) {
    parts.push("Secure");
  }
  return parts.join("; ");
};

type CreatorSetup = CreatorSupportPublic & {
  creatorId: string;
  stripeConnect: {
    available: boolean;
    connected: boolean;
    ready: boolean;
  };
  topicId: string;
  topicName: string;
};

const getSupportMethods = async ({
  creatorId,
  displayName,
  topicId,
  topicName,
}: {
  creatorId: string;
  displayName: string;
  topicId: string;
  topicName: string;
}): Promise<CreatorSetup> => {
  const methods = await sql<{
    paypal_me_url: string | null;
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    venmo_url: string | null;
  }>`
    SELECT paypal_me_url, venmo_url, stripe_account_id,
      stripe_charges_enabled, stripe_payouts_enabled
    FROM creator_support_methods
    WHERE creator_id = ${creatorId}
    LIMIT 1;
  `;
  const method = methods[0];
  const connect = getStripeConnectConfig();
  return {
    creatorId,
    displayName,
    paypalMeUrl: method?.paypal_me_url ?? null,
    stripeConnect: {
      available: connect.enabled,
      connected: Boolean(method?.stripe_account_id),
      ready: Boolean(
        connect.enabled &&
        method?.stripe_account_id &&
        method.stripe_charges_enabled &&
        method.stripe_payouts_enabled,
      ),
    },
    topicId,
    topicName,
    venmoUrl: method?.venmo_url ?? null,
  };
};

export const createTopicOwnerInviteServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof createTopicOwnerInviteSchema>;
  request: Request;
}) => {
  const rawToken = createToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_MAX_AGE_MS);
  const result = await sql.begin(async (tx) => {
    const topics = await tx<{ id: string; name: string }>`
      SELECT id, name
      FROM topics
      WHERE name = ${data.topicName}
      LIMIT 1
      FOR UPDATE;
    `;
    const topic = topics[0];
    if (!topic) return null;

    const owners = await tx<{ creator_id: string }>`
      SELECT creator_id
      FROM topic_owners
      WHERE topic_id = ${topic.id}
      LIMIT 1;
    `;
    let creatorId = owners[0]?.creator_id;
    if (creatorId) {
      await tx`
        UPDATE creators
        SET display_name = ${data.displayName}, updated_at = NOW()
        WHERE id = ${creatorId};
      `;
    } else {
      const creators = await tx<{ id: string }>`
        INSERT INTO creators (display_name)
        VALUES (${data.displayName})
        RETURNING id;
      `;
      creatorId = creators[0]?.id;
      if (!creatorId) throw new Error("Could not create the creator record.");
    }

    await tx`
      UPDATE topic_owner_invites
      SET used_at = NOW()
      WHERE topic_id = ${topic.id} AND used_at IS NULL;
    `;
    await tx`
      INSERT INTO topic_owner_invites (
        topic_id, creator_id, token_hash, expires_at
      ) VALUES (
        ${topic.id}, ${creatorId}, ${tokenHash}, ${expiresAt}
      );
    `;
    return { topicId: topic.id, topicName: topic.name };
  });
  if (!result) {
    return { ok: false as const, error: "Topic not found.", status: 404 };
  }

  const origin = resolvePaymentApplicationOrigin({
    configuredBaseUrl: getServerEnv("APP_BASE_URL"),
    isProduction: process.env.NODE_ENV === "production",
    requestUrl: request.url,
  });
  const claimUrl = new URL(
    `/t/${encodeURIComponent(result.topicName)}/support/claim`,
    origin,
  );
  claimUrl.hash = `token=${encodeURIComponent(rawToken)}`;
  return {
    ok: true as const,
    data: {
      claimUrl: claimUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      topicId: result.topicId,
    },
  };
};

export const claimTopicOwnerInviteServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof claimTopicOwnerInviteSchema>;
  request: Request;
}) => {
  const sessionToken = createToken();
  const sessionHash = hashToken(sessionToken);
  const sessionExpiresAt = new Date(
    Date.now() + SETUP_SESSION_MAX_AGE_SECONDS * 1000,
  );
  const claim = await sql.begin(async (tx) => {
    const invites = await tx<{
      creator_id: string;
      display_name: string;
      id: string;
      topic_id: string;
      topic_name: string;
    }>`
      SELECT invite.id, invite.topic_id, invite.creator_id,
        topic.name AS topic_name, creator.display_name
      FROM topic_owner_invites AS invite
      JOIN topics AS topic ON topic.id = invite.topic_id
      JOIN creators AS creator ON creator.id = invite.creator_id
      WHERE invite.token_hash = ${hashToken(data.token)}
        AND topic.name = ${data.topicName}
        AND invite.used_at IS NULL
        AND invite.expires_at > NOW()
      LIMIT 1
      FOR UPDATE OF invite;
    `;
    const invite = invites[0];
    if (!invite) return null;

    await tx`
      UPDATE topic_owner_invites
      SET used_at = NOW()
      WHERE id = ${invite.id};
    `;
    await tx`
      INSERT INTO topic_owners (topic_id, creator_id)
      VALUES (${invite.topic_id}, ${invite.creator_id})
      ON CONFLICT (topic_id) DO UPDATE
      SET creator_id = EXCLUDED.creator_id;
    `;
    await tx`
      UPDATE creator_setup_sessions
      SET revoked_at = NOW()
      WHERE topic_id = ${invite.topic_id} AND revoked_at IS NULL;
    `;
    await tx`
      INSERT INTO creator_setup_sessions (
        invite_id, topic_id, creator_id, token_hash, expires_at
      ) VALUES (
        ${invite.id}, ${invite.topic_id}, ${invite.creator_id},
        ${sessionHash}, ${sessionExpiresAt}
      );
    `;
    return invite;
  });
  if (!claim) {
    return { ok: false as const, error: "This invite is invalid or expired." };
  }

  const setup = await getSupportMethods({
    creatorId: claim.creator_id,
    displayName: claim.display_name,
    topicId: claim.topic_id,
    topicName: claim.topic_name,
  });
  return {
    ok: true as const,
    data: setup,
    setCookie: buildSetupCookie({
      request,
      topicId: claim.topic_id,
      token: sessionToken,
    }),
  };
};

const resolveCreatorSetup = async ({
  data,
  request,
}: {
  data: z.infer<typeof loadCreatorSupportSetupSchema>;
  request: Request;
}) => {
  const owners = await sql<{
    creator_id: string;
    display_name: string;
    topic_id: string;
    topic_name: string;
  }>`
    SELECT owner.creator_id, creator.display_name,
      topic.id AS topic_id, topic.name AS topic_name
    FROM topics AS topic
    JOIN topic_owners AS owner ON owner.topic_id = topic.id
    JOIN creators AS creator ON creator.id = owner.creator_id
    WHERE topic.name = ${data.topicName}
    LIMIT 1;
  `;
  const owner = owners[0];
  if (!owner) return null;
  const token = getRequestCookie(request, getSetupCookieName(owner.topic_id));
  if (!token) return null;
  const sessions = await sql<{ id: string }>`
    SELECT id
    FROM creator_setup_sessions
    WHERE topic_id = ${owner.topic_id}
      AND creator_id = ${owner.creator_id}
      AND token_hash = ${hashToken(token)}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1;
  `;
  if (!sessions[0]) return null;
  return getSupportMethods({
    creatorId: owner.creator_id,
    displayName: owner.display_name,
    topicId: owner.topic_id,
    topicName: owner.topic_name,
  });
};

export const loadCreatorSupportSetupServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof loadCreatorSupportSetupSchema>;
  request: Request;
}) => {
  const setup = await resolveCreatorSetup({ data, request });
  if (setup?.stripeConnect.connected && setup.stripeConnect.available) {
    try {
      await refreshStripeAccountStatus(setup.creatorId);
      return {
        ok: true as const,
        data: await getSupportMethods({
          creatorId: setup.creatorId,
          displayName: setup.displayName,
          topicId: setup.topicId,
          topicName: setup.topicName,
        }),
      };
    } catch (error) {
      console.warn("Could not refresh Stripe Connect status", {
        creatorId: setup.creatorId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return setup
    ? { ok: true as const, data: setup }
    : { ok: false as const, error: "Open a current creator invite." };
};

const refreshStripeAccountStatus = async (creatorId: string) => {
  const methods = await sql<{ stripe_account_id: string | null }>`
    SELECT stripe_account_id
    FROM creator_support_methods
    WHERE creator_id = ${creatorId}
    LIMIT 1;
  `;
  const accountId = methods[0]?.stripe_account_id;
  if (!accountId) return;
  const account = await retrieveStripeConnectedAccount(accountId);
  await sql`
    UPDATE creator_support_methods
    SET stripe_charges_enabled = ${Boolean(account.charges_enabled)},
        stripe_payouts_enabled = ${Boolean(account.payouts_enabled)},
        updated_at = NOW()
    WHERE creator_id = ${creatorId}
      AND stripe_account_id = ${accountId};
  `;
};

export const createStripeConnectOnboardingServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof createStripeConnectOnboardingSchema>;
  request: Request;
}) => {
  const setup = await resolveCreatorSetup({ data, request });
  if (!setup) {
    return { ok: false as const, error: "This setup session has expired." };
  }
  if (!getStripeConnectConfig().enabled) {
    return {
      ok: false as const,
      error: "Managed payouts are not available yet.",
    };
  }

  try {
    const methods = await sql<{ stripe_account_id: string | null }>`
      SELECT stripe_account_id
      FROM creator_support_methods
      WHERE creator_id = ${setup.creatorId}
      LIMIT 1;
    `;
    let accountId = methods[0]?.stripe_account_id ?? null;
    if (!accountId) {
      const account = await createStripeConnectedAccount(setup.creatorId);
      accountId = account.id;
      await sql`
        INSERT INTO creator_support_methods (creator_id, stripe_account_id)
        VALUES (${setup.creatorId}, ${accountId})
        ON CONFLICT (creator_id) DO UPDATE
        SET stripe_account_id = COALESCE(
              creator_support_methods.stripe_account_id,
              EXCLUDED.stripe_account_id
            ),
            updated_at = NOW();
      `;
      const saved = await sql<{ stripe_account_id: string | null }>`
        SELECT stripe_account_id
        FROM creator_support_methods
        WHERE creator_id = ${setup.creatorId}
        LIMIT 1;
      `;
      accountId = saved[0]?.stripe_account_id ?? accountId;
    }

    const origin = resolvePaymentApplicationOrigin({
      configuredBaseUrl: getServerEnv("APP_BASE_URL"),
      isProduction: process.env.NODE_ENV === "production",
      requestUrl: request.url,
    });
    const claimUrl = new URL(
      `/t/${encodeURIComponent(setup.topicName)}/support/claim`,
      origin,
    );
    const refreshUrl = new URL(claimUrl);
    refreshUrl.searchParams.set("stripe", "refresh");
    const returnUrl = new URL(claimUrl);
    returnUrl.searchParams.set("stripe", "return");
    const link = await createStripeConnectedAccountLink({
      accountId,
      refreshUrl: refreshUrl.toString(),
      returnUrl: returnUrl.toString(),
    });
    return { ok: true as const, data: { url: link.url } };
  } catch (error) {
    console.error("Failed to create Stripe Connect onboarding link", {
      creatorId: setup.creatorId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false as const,
      error: "Could not open managed payout setup. Please try again.",
    };
  }
};

export const saveCreatorSupportMethodsServer = async ({
  data,
  request,
}: {
  data: z.infer<typeof saveCreatorSupportMethodsSchema>;
  request: Request;
}) => {
  const setup = await resolveCreatorSetup({ data, request });
  if (!setup) {
    return { ok: false as const, error: "This setup session has expired." };
  }

  let paypalMeUrl: string | null = null;
  let venmoUrl: string | null = null;
  try {
    paypalMeUrl = data.paypalMeUrl?.trim()
      ? normalizePayPalMeUrl(data.paypalMeUrl)
      : null;
    venmoUrl = data.venmoUrl?.trim()
      ? normalizeVenmoBusinessUrl(data.venmoUrl)
      : null;
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Invalid support link.",
    };
  }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE creators
      SET display_name = ${data.displayName}, updated_at = NOW()
      WHERE id = ${setup.creatorId};
    `;
    await tx`
      INSERT INTO creator_support_methods (
        creator_id, paypal_me_url, venmo_url
      ) VALUES (
        ${setup.creatorId}, ${paypalMeUrl}, ${venmoUrl}
      )
      ON CONFLICT (creator_id) DO UPDATE
      SET paypal_me_url = EXCLUDED.paypal_me_url,
          venmo_url = EXCLUDED.venmo_url,
          updated_at = NOW();
    `;
  });

  return {
    ok: true as const,
    data: {
      displayName: data.displayName,
      paypalMeUrl,
      venmoUrl,
    } satisfies CreatorSupportPublic,
  };
};

export const getCreatorSupportForPerspective = async (
  perspectiveId: string,
) => {
  const rows = await sql<{
    creator_id: string;
    display_name: string;
    paypal_me_url: string | null;
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    venmo_url: string | null;
  }>`
    SELECT owner.creator_id, creator.display_name,
      methods.paypal_me_url, methods.venmo_url,
      methods.stripe_account_id, methods.stripe_charges_enabled,
      methods.stripe_payouts_enabled
    FROM perspectives AS perspective
    JOIN topic_owners AS owner ON owner.topic_id = perspective.topic_id
    JOIN creators AS creator ON creator.id = owner.creator_id
    LEFT JOIN creator_support_methods AS methods
      ON methods.creator_id = owner.creator_id
    WHERE perspective.id = ${perspectiveId}
    LIMIT 1;
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    creatorId: row.creator_id,
    displayName: row.display_name,
    paypalMeUrl: row.paypal_me_url,
    stripeAccountId: row.stripe_account_id,
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
    venmoUrl: row.venmo_url,
  };
};
