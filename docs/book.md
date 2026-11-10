# Writing and selling the book

This site has one book. Open `/book/write` and sign in using `BOOK_AUTHOR_KEY`
(or the existing `EL_KEY` / `TS_KEY` when no dedicated key is configured).
The author session lasts twelve hours. Reader purchases never grant editing access.

## Writing

Set the book title, URL name, author, introduction, and optional USD price in the
author area. The default public address is `/book`; `/c` also opens the book.
Chapters use `/<book-name>/c/<chapter-name>`. `/book` remains an entry point after
the URL name changes. Chapter URL names are chosen when creating a chapter.

Create a chapter, add perspectives, and move them into reading order. **Save draft**
stores private text; **Publish saved draft** publishes that exact version.
Save changes before publishing. Conflicting edits are rejected: copy your text
before reloading another tab's changes. Published perspectives retain their IDs.

The first chapter created starts free; later chapters start paid. The explicit
“Free to read” setting is saved with the draft and applied on publishing.
Reordering chapters does not change that setting. Draft text is stored separately
from published perspectives and is never returned to readers.

## Reader purchases

Readers verify their email before buying. A single Stripe payment unlocks all
paid chapters, including future chapters. The price is editable from $1 to $1,000
USD; leave it empty to disable checkout. Price changes affect new orders.
Chapter content in this release is text; protected audio and images are deferred.

Required server configuration:

```dotenv
APP_BASE_URL=https://your-site.example
BOOK_AUTHOR_KEY=your-private-author-key
RESEND_API_KEY=your-resend-key
BOOK_EMAIL_FROM=Your Book <reading@your-verified-domain.example>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYMENTS_LIVE_ENABLED=true
```

Use matching `sk_test_` / `pk_test_` keys for sandbox testing. Configure the signed
Stripe webhook at `/api/obj/stripe-webhook` for `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, and `charge.refunded`, in addition to
existing story-payment events. Only verified paid sessions grant access. Pending,
canceled, and failed payments do not. Full refunds revoke access; partial refunds
retain it. Duplicate and delayed notifications cannot restore refunded access.

Sign-in links expire after fifteen minutes and require a confirmation button.
Reader sessions last thirty days and can be ended by signing out. Resend needs a
verified sender domain. The author area reports whether email, payments, and
proofreading are configured. Sales stay unavailable until email, price, Stripe,
and webhook configuration are ready. Run a sandbox purchase/refund before live use.

## Proofreading

Set `OPENAI_API_KEY` on the server. Optionally set `OPENAI_PROOFREAD_MODEL`
(default: `gpt-4o-mini`). Click **Proofread this perspective** to send only that
perspective, up to 12,000 characters. Requests are limited to ten per hour per IP.

Suggestions cover spelling, missing words, and word order. Accept or dismiss each
one. Accepted corrections change the unsaved draft only; Save and Publish remain
separate. Text changes invalidate pending suggestions. No automatic rewriting or
background proofreading occurs. API failures leave the draft intact.

## Validation

Run the Docker validation sequence in `AGENTS.md`. After migrating the local
database, `docker compose -f compose.yml exec web bun scripts/check-book.ts`
checks author login, drafts, conflicts, publishing, alternate-route paywalls,
buyer/refund access, and free reading. It removes its own test records.
