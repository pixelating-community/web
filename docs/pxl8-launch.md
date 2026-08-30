# PXL8 two-day launch runbook

This runbook keeps the current site intact while PXL8 is prepared on the same
server. The PXL8 production Compose project binds only to `127.0.0.1:3100` and
uses its own `pxl8_postgres_data` volume.

Never commit credentials. Local values go in the repository-root `.env`.
Production values belong in Vault as the deployment `app_env_content` secret.

## Day 1 — application and sandbox payments

- [x] Add anonymous, one-per-browser virtual voting.
- [x] Add separate virtual-vote and completed-payment totals.
- [x] Add fixed $3 Three Dream and $25 Handwritten Copy tiers.
- [x] Collect a shipping address only for the physical $25 tier.
- [x] Add embedded Stripe card/wallet checkout.
- [x] Add optional PayPal and Venmo checkout.
- [x] Verify provider amounts, currency, tier, and perspective on the server.
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
PAYMENTS_LIVE_ENABLED=false
SUPPORT_SHIPPING_COUNTRIES=US

PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_WEBHOOK_ID=
```

Stripe is the primary path. PayPal/Venmo stays hidden until all required
credentials are present. In production, each provider also stays hidden until
its webhook credential is present.

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
- [ ] Optionally create the PayPal webhook endpoint:
      `https://pxl8.ing/api/obj/paypal-webhook`, subscribing to
      `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.REFUNDED`.
- [ ] Run one real $3 payment and refund it; verify both the total and provider
      dashboard after each event.
- [ ] Run one real $25 payment; verify that the shipping address is captured.
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
PAYMENTS_LIVE_ENABLED=true
SUPPORT_SHIPPING_COUNTRIES=US

# Optional until PayPal/Venmo is enabled
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_ENVIRONMENT=live
PAYPAL_WEBHOOK_ID=
```

Before handoff or deployment, run the repository validation sequence from
`AGENTS.md`. Do not switch DNS or enable live PayPal until the matching webhook
has been created and its ID is in the production secret.
