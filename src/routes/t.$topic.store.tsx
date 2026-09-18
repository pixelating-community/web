import { createFileRoute, Link } from "@tanstack/react-router";
import { NotFoundPage } from "@/components/NotFoundPage";
import { loadTopicPayload } from "@/lib/topicPayloadRoute.functions";
import {
  formatContributionTotal,
  SUPPORT_CURRENCY,
  SUPPORT_PRODUCTS,
} from "@/lib/perspectiveSupport";

export const Route = createFileRoute("/t/$topic/store")({
  loader: ({ params }) =>
    loadTopicPayload({ data: { topicName: params.topic } }),
  pendingMs: 1500,
  pendingComponent: StorePending,
  component: TopicStoreRoute,
});

function StorePending() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 text-sm text-[color:var(--color-white)]">
      Loading story shop…
    </main>
  );
}

function TopicStoreRoute() {
  const result = Route.useLoaderData();
  const { topic: requestedTopic } = Route.useParams();

  if (result.error || !result.data?.topic.id) return <NotFoundPage />;

  const { perspectives, topic } = result.data;
  const featuredPerspective = perspectives[0] ?? null;
  const storyPreview =
    topic.canAccess && featuredPerspective?.perspective
      ? featuredPerspective.perspective.trim().slice(0, 420)
      : "";

  return (
    <main className="min-h-dvh w-full px-4 py-10 text-[color:var(--color-white)] sm:py-16">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            to="/t/$"
            params={{ _splat: topic.name || requestedTopic }}
            className="w-fit text-sm text-[color:var(--color-neon-teal-light)] underline decoration-[color:color-mix(in_oklch,var(--color-neon-teal)_45%,transparent)] underline-offset-4"
          >
            ← View {topic.name}
          </Link>
          <div>
            <p className="m-0 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-neon-teal-light)]">
              PXL8 story shop
            </p>
            <h1 className="mt-2 mb-0 text-4xl font-black sm:text-5xl">
              Digital stories and handwritten copies
            </h1>
          </div>
          <p className="m-0 max-w-3xl leading-relaxed text-[color:color-mix(in_oklch,var(--color-white)_78%,transparent)]">
            Choose a personal digital edition or a handwritten copy of the
            featured story from <strong>{topic.name}</strong>. Prices and
            delivery details are shown before payment.
          </p>
        </header>

        {storyPreview ? (
          <section className="support-surface flex flex-col gap-2 p-5 sm:p-6">
            <h2 className="m-0 text-lg font-black">Featured story</h2>
            <p className="m-0 whitespace-pre-line text-sm leading-relaxed text-[color:color-mix(in_oklch,var(--color-white)_72%,transparent)]">
              {storyPreview}
              {featuredPerspective?.perspective &&
              featuredPerspective.perspective.length > storyPreview.length
                ? "…"
                : ""}
            </p>
          </section>
        ) : null}

        <section aria-labelledby="products-heading" className="flex flex-col gap-4">
          <h2 id="products-heading" className="m-0 text-2xl font-black">
            Available products
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {SUPPORT_PRODUCTS.map((product) => {
              const href = featuredPerspective
                ? `/p/${encodeURIComponent(featuredPerspective.id)}?product=${encodeURIComponent(product.id)}`
                : null;
              return (
                <article
                  key={product.id}
                  className="support-surface flex min-h-72 flex-col gap-4 p-5 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="m-0 text-xl font-black">{product.name}</h3>
                    <p className="m-0 whitespace-nowrap text-xl font-black text-[color:var(--color-neon-teal-light)]">
                      {formatContributionTotal(
                        product.amountMinor,
                        SUPPORT_CURRENCY,
                      )}
                    </p>
                  </div>
                  <p className="m-0 text-sm leading-relaxed text-[color:color-mix(in_oklch,var(--color-white)_76%,transparent)]">
                    {product.description}
                  </p>
                  <p className="m-0 text-xs leading-relaxed text-[color:color-mix(in_oklch,var(--color-white)_56%,transparent)]">
                    {product.fulfillment}
                  </p>
                  {product.requiresShipping ? (
                    <p className="m-0 text-xs font-bold text-[color:var(--color-neon-teal-light)]">
                      Stripe securely collects the mailing address during
                      checkout.
                    </p>
                  ) : null}
                  <div className="mt-auto pt-2">
                    {href ? (
                      <a
                        href={href}
                        className="support-primary-action flex min-h-12 items-center justify-center px-4 text-center text-sm font-bold uppercase transition-colors"
                      >
                        Buy {product.name}
                      </a>
                    ) : (
                      <p className="support-subtle-panel m-0 px-4 py-3 text-center text-sm">
                        This story is not available to purchase yet.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="support-surface flex flex-col gap-3 p-5 text-sm leading-relaxed sm:p-6">
          <h2 className="m-0 text-xl font-black">Fulfillment and refunds</h2>
          <p className="m-0 text-sm text-[color:color-mix(in_oklch,var(--color-white)_72%,transparent)]">
            Digital orders are sent to the email used at checkout. Handwritten
            orders are mailed to the shipping address entered at checkout.
            Orders we cannot fulfill are refunded in full.
          </p>
          <p className="m-0 text-sm text-[color:color-mix(in_oklch,var(--color-white)_72%,transparent)]">
            For an order question, cancellation, missing delivery, or damaged
            copy, use the seller support contact shown on your Stripe or PayPal
            receipt. Include the receipt or order number so the purchase can be
            located.
          </p>
        </section>
      </div>
    </main>
  );
}
