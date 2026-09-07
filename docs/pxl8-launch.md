# PXL8 two-day launch runbook

This runbook keeps the current site intact while PXL8 is prepared on the same
server. The PXL8 production Compose project binds only to `127.0.0.1:3100` and
uses its own `pxl8_postgres_data` volume.

Never commit credentials. Local values go in the repository-root `.env`.
Production values belong in Vault as the deployment `app_env_content` secret.

## Day 1 — application and sandbox payments

- [x] Add anonymous, one-per-browser virtual voting.
- [x] Add separate virtual-vote and completed-payment totals.
- [x] Accept custom story-support amounts from $1.00.
- [x] Add embedded Stripe card/wallet checkout.
- [x] Add optional PayPal and Venmo checkout.
- [x] Verify provider amounts, currency, contribution, and perspective on the server.
- [x] Add invite-only creator support links that are excluded from PXL8 totals.
- [x] Gate managed creator Stripe payments behind onboarding and approval flags.
- [x] Make webhook processing signed, idempotent, and refund-aware.
- [ ] Put Stripe test keys and a Stripe CLI webhook secret in local `.env`.
- [ ] Exercise successful, declined, canceled, duplicate-webhook, and refunded
      sandbox transactions.
- [ ] Add PayPal sandbox credentials when available and repeat those checks.

Local payment variables:

```dotenv
APP_BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_ENABLED=false
STRIPE_CONNECT_APPROVED=false
STRIPE_CONNECT_WEBHOOK_SECRET=
PAYMENTS_LIVE_ENABLED=false

PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=
```

Stripe is the primary path. PayPal/Venmo stays hidden until all required
credentials are present. In production, each provider also stays hidden until
its webhook credential is present.

Create a single-use, 24-hour creator setup link for an existing topic with:

```sh
curl -X POST "$APP_BASE_URL/api/obj/topic-owner-invites" \
  -H "Authorization: Bearer $EL_KEY" \
  -H "Content-Type: application/json" \
  --data '{"topicName":"art","displayName":"Creator name"}'
```

Send only the returned `claimUrl` to that creator. Ownership activates when
the link is claimed; the editing session then lasts 30 minutes. Issue a new
invite to change the links later.

## Day 2 — PXL8 production and live payment cutover

- [ ] Archive the old database and media, encrypt the archive, copy it to
      Dropbox, and verify that the archive can be read before changing DNS.
- [ ] Create the `pxl8-media` object bucket and `obj.pxl8.ing` custom domain.
- [ ] Configure Cloudflare DNS/TLS for `pxl8.ing`, `www.pxl8.ing`, and
      `we.pxl8.ing` against the existing Hetzner server.
- [ ] Install `infra/nginx/pxl8.conf.example` as the PXL8 Nginx virtual host,
      add its Origin CA files, and verify that it proxies to `127.0.0.1:3100`.
- [ ] Set the GitHub `DEPLOY_PATH` variable to `/var/www/pxl8` (or use the new
      workflow default).
- [ ] Create a new Vault production secret with the variables below.
- [ ] Deploy the new Compose project and confirm the new database is empty.
- [ ] Register `pxl8.ing` as a Stripe payment-method domain.
- [ ] Create the Stripe webhook endpoint:
      `https://pxl8.ing/api/obj/stripe-webhook`.
- [ ] Subscribe Stripe to `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`,
      `checkout.session.async_payment_failed`, `checkout.session.expired`,
      `charge.refunded`, and `payment_intent.payment_failed`.
- [ ] If Connect has been approved, create the connected-account webhook at
      `https://pxl8.ing/api/obj/stripe-connect-webhook`; subscribe it to
      `account.updated` and the payment events above, then store its separate
      signing secret as `STRIPE_CONNECT_WEBHOOK_SECRET`.
- [ ] Optionally create the PayPal webhook endpoint:
      `https://pxl8.ing/api/obj/paypal-webhook`, subscribing to
      `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.REFUNDED`.
- [ ] Run one real $3 payment and refund it; verify both the total and provider
      dashboard after each event.
- [ ] Run a second custom-amount payment and verify the exact amount.
- [ ] Check the site on mobile and desktop, then make PXL8 DNS public.

Minimum production payment values:

```dotenv
NODE_ENV=production
APP_BASE_URL=https://pxl8.ing
POSTGRES_DB=pxl8
APP_HOST_PORT=3100

STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_ENABLED=false
STRIPE_CONNECT_APPROVED=false
STRIPE_CONNECT_WEBHOOK_SECRET=
PAYMENTS_LIVE_ENABLED=true

# Optional until PayPal/Venmo is enabled
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=live
PAYPAL_WEBHOOK_ID=
```

Before handoff or deployment, run the repository validation sequence from
`AGENTS.md`. Do not switch DNS or enable live PayPal until the matching webhook
has been created and its ID is in the production secret.

Leave `STRIPE_CONNECT_ENABLED=false` until Stripe Connect approval and a full
sandbox creator-onboarding/direct-charge test are complete. For live Connect,
both Connect flags must be true. PXL8 takes no application fee from direct
charges. PayPal.Me and Venmo Business links send supporters to the creator and
are intentionally not added to PXL8's verified total.
