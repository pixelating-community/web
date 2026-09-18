"use client";

import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { PayPalContributionCheckout } from "@/components/PayPalContributionCheckout";
import { StripeContributionCheckout } from "@/components/StripeContributionCheckout";
import {
  castPerspectiveVote,
  createStripeContributionSession,
  loadPerspectiveSupport,
  reconcileStripeContribution,
} from "@/lib/perspectiveSupport.functions";
import {
  formatContributionTotal,
  getSupportProduct,
  getSupportProductById,
  SUPPORT_CURRENCY,
  SUPPORT_PRODUCTS,
  type PerspectiveSupportStats,
} from "@/lib/perspectiveSupport";
import type { Perspective } from "@/types/perspectives";

type SupportData = PerspectiveSupportStats & {
  creatorSupport: {
    displayName: string;
    paypalMeUrl: string | null;
    venmoUrl: string | null;
  } | null;
  minAmountMinor: number;
  providers: {
    paypal: {
      clientId: string | null;
      currency: string;
      enabled: boolean;
      environment: "live" | "sandbox";
    };
    stripe: {
      connectedAccountId: string | null;
      currency: string;
      enabled: boolean;
      environment: "live" | "sandbox";
      publishableKey: string | null;
    };
  };
};

type StripeSession = {
  amountMinor: number;
  clientSecret: string;
  connectedAccountId: string | null;
  returnUrl: string;
  sessionId: string;
};

export const PerspectiveSupport = ({
  perspective,
}: {
  perspective: Perspective;
}) => {
  const loadSupportFn = useServerFn(loadPerspectiveSupport);
  const castVoteFn = useServerFn(castPerspectiveVote);
  const createStripeSessionFn = useServerFn(createStripeContributionSession);
  const reconcileStripeFn = useServerFn(reconcileStripeContribution);
  const reconciledSessionRef = useRef<string | null>(null);
  const [support, setSupport] = useState<SupportData | null>(null);
  const [amountMinor, setAmountMinor] = useState<number>(
    SUPPORT_PRODUCTS[0].amountMinor,
  );
  const [showContribution, setShowContribution] = useState(false);
  const [showAlternativePayments, setShowAlternativePayments] = useState(false);
  const [stripeSession, setStripeSession] = useState<StripeSession | null>(
    null,
  );
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const applyStats = useCallback((stats: PerspectiveSupportStats | null) => {
    if (!stats) return;
    setSupport((previous) => (previous ? { ...previous, ...stats } : null));
  }, []);

  useEffect(() => {
    let active = true;
    void loadSupportFn({ data: { perspectiveId: perspective.id } })
      .then((result) => {
        if (!active) return;
        if (result.ok) setSupport(result.data);
        else setError(result.error);
      })
      .catch(() => {
        if (active) setError("Could not load support totals.");
      });
    return () => {
      active = false;
    };
  }, [loadSupportFn, perspective.id]);

  const handleVote = async () => {
    if (isVoting || support?.hasVoted) return;
    setIsVoting(true);
    setError("");
    try {
      const result = await castVoteFn({
        data: { perspectiveId: perspective.id },
      });
      if (!result.ok) throw new Error(result.error);
      applyStats(result.data);
      setStatus(
        result.data.voteAdded
          ? "Vote counted."
          : "Your vote was already counted.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not add vote.",
      );
    } finally {
      setIsVoting(false);
    }
  };

  const verifyStripeContribution = useCallback(
    async (sessionId: string) => {
      const result = await reconcileStripeFn({
        data: { perspectiveId: perspective.id, sessionId },
      });
      if (!result.ok) throw new Error(result.error);
      applyStats(result.data.stats);
      setStatus(
        result.data.pending
          ? "Your payment is processing. The total will update when it clears."
          : "Payment confirmed.",
      );
    },
    [applyStats, perspective.id, reconcileStripeFn],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("stripe_session_id");
    if (
      !sessionId ||
      !/^cs_[A-Za-z0-9_]+$/.test(sessionId) ||
      reconciledSessionRef.current === sessionId
    ) {
      return;
    }

    reconciledSessionRef.current = sessionId;
    setShowContribution(true);
    setStatus("Checking payment…");
    setError("");
    url.searchParams.delete("stripe_session_id");
    window.history.replaceState({}, "", url);

    void verifyStripeContribution(sessionId).catch((reason) => {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not verify payment yet.",
      );
      setStatus("");
    });
  }, [verifyStripeContribution]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const product = getSupportProductById(url.searchParams.get("product"));
    if (!product) return;

    url.searchParams.delete("product");
    window.history.replaceState({}, "", url);
    const frame = window.requestAnimationFrame(() => {
      setAmountMinor(product.amountMinor);
      setShowContribution(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const beginStripeCheckout = async () => {
    const stripe = support?.providers.stripe;
    if (!support || !stripe?.enabled || !stripe.publishableKey) {
      setError("Card checkout is not configured yet.");
      return;
    }
    if (!getSupportProduct(amountMinor)) {
      setError("Choose Digital Story or Handwritten Copy.");
      return;
    }

    setIsStartingCheckout(true);
    setError("");
    setStatus("");
    try {
      const result = await createStripeSessionFn({
        data: { amountMinor, perspectiveId: perspective.id },
      });
      if (!result.ok) throw new Error(result.error);
      setStripeSession({ ...result.data, amountMinor });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start secure checkout.",
      );
    } finally {
      setIsStartingCheckout(false);
    }
  };

  const virtualVoteCount =
    support?.virtualVoteCount ?? perspective.virtual_vote_count ?? 0;
  const contributionTotalMinor =
    support?.contributionTotalMinor ??
    perspective.contribution_total_minor ??
    0;
  const currency =
    support?.contributionCurrency ??
    perspective.contribution_currency ??
    SUPPORT_CURRENCY;
  const paypal = support?.providers.paypal;
  const stripe = support?.providers.stripe;
  const creatorSupport = support?.creatorSupport;
  const hasDirectSupport = Boolean(
    creatorSupport?.paypalMeUrl || creatorSupport?.venmoUrl,
  );
  const hasCreatorManagedCheckout = Boolean(
    creatorSupport && stripe?.enabled && stripe.publishableKey,
  );
  const amountLocked = Boolean(stripeSession || isStartingCheckout);
  const selectedProduct =
    getSupportProduct(amountMinor) ?? SUPPORT_PRODUCTS[0];

  return (
    <section
      aria-label="Support this story"
      className="relative z-20 flex w-11 shrink-0 flex-col items-center"
    >
      <div className="flex w-11 flex-col items-center gap-0.5">
        <div className="flex max-w-full flex-col items-center gap-0.5">
          <div className="flex w-fit max-w-full flex-col items-center gap-0.5 text-center">
            <button
              type="button"
              onClick={() => void handleVote()}
              disabled={isVoting || support?.hasVoted}
              aria-label={
                support?.hasVoted
                  ? `${virtualVoteCount} virtual votes. Your vote is counted.`
                  : `Add a virtual vote. ${virtualVoteCount} votes so far.`
              }
              className={`inline-flex min-h-7 items-center gap-1 whitespace-nowrap border-0 bg-transparent px-1 text-[10px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                support?.hasVoted
                  ? "text-pink-100"
                  : "text-white/45 enabled:hover:text-pink-100"
              }`}
            >
              <span aria-hidden="true">{support?.hasVoted ? "♥" : "♡"}</span>
              <span>{virtualVoteCount}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowContribution((value) => !value)}
              className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap border-0 bg-transparent px-1 text-[10px] leading-none text-white/45 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 hover:text-[color:var(--color-neon-teal-light)]"
              aria-expanded={showContribution}
              aria-label={`Support this story. ${formatContributionTotal(contributionTotalMinor, currency)} backed.`}
            >
              <span aria-hidden="true">💰</span>
              <span>
                {formatContributionTotal(contributionTotalMinor, currency)}
              </span>
            </button>
          </div>
        </div>

        {showContribution ? (
          <div className="support-surface scrollbar-transparent fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50 mx-auto flex max-h-[calc(100dvh-2rem)] w-auto max-w-sm flex-col gap-3 overflow-y-auto p-4">
            <button
              type="button"
              onClick={() => setShowContribution(false)}
              aria-label="Close support options"
              title="Close"
              className="ml-auto inline-flex h-7 w-7 items-center justify-center border-0 bg-transparent text-base text-[color:color-mix(in_oklch,var(--color-white)_65%,transparent)] hover:text-[color:var(--color-white)]"
            >
              ×
            </button>
            {creatorSupport ? (
              <div className="flex flex-col gap-2">
                <p className="m-0 text-sm font-bold text-[color:var(--color-white)]">
                  {creatorSupport.displayName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {creatorSupport.paypalMeUrl ? (
                    <a
                      href={creatorSupport.paypalMeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="support-secondary-action px-3 py-2 text-sm transition-colors"
                    >
                      PayPal ↗
                    </a>
                  ) : null}
                  {creatorSupport.venmoUrl ? (
                    <a
                      href={creatorSupport.venmoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="support-secondary-action px-3 py-2 text-sm transition-colors"
                    >
                      Venmo ↗
                    </a>
                  ) : null}
                </div>
                {hasDirectSupport ? (
                  <p className="m-0 text-[11px] text-[color:color-mix(in_oklch,var(--color-white)_48%,transparent)]">
                    Direct links · not counted here
                  </p>
                ) : (
                  <p className="m-0 text-xs text-[color:color-mix(in_oklch,var(--color-white)_58%,transparent)]">
                    Support links are not ready yet.
                  </p>
                )}
              </div>
            ) : null}
            {!creatorSupport || hasCreatorManagedCheckout ? (
              <>
                {stripeSession ? (
                  <div className="support-subtle-panel flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      {selectedProduct.name} — {formatContributionTotal(
                        stripeSession.amountMinor,
                        currency,
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setStripeSession(null);
                        setError("");
                      }}
                      aria-label="Change story product"
                      title="Change story product"
                      className="text-base text-[color:var(--color-neon-magenta)]"
                    >
                      ↺
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2" aria-label="Story product">
                    {SUPPORT_PRODUCTS.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        disabled={amountLocked}
                        onClick={() => {
                          setAmountMinor(product.amountMinor);
                          setError("");
                        }}
                        className={`flex min-h-24 flex-col items-start justify-between border px-3 py-3 text-left transition-colors ${
                          amountMinor === product.amountMinor
                            ? "border-[color:color-mix(in_oklch,var(--color-neon-magenta)_58%,transparent)] bg-[color:color-mix(in_oklch,var(--color-neon-magenta)_10%,transparent)] text-[color:var(--color-white)]"
                            : "border-[color:color-mix(in_oklch,var(--color-white)_13%,transparent)] bg-transparent text-[color:color-mix(in_oklch,var(--color-white)_68%,transparent)] hover:bg-[color:color-mix(in_oklch,var(--color-black)_14%,transparent)]"
                        }`}
                      >
                        <span className="text-xs font-bold uppercase leading-tight">
                          {product.name}
                        </span>
                        <span className="text-lg font-black">
                          {formatContributionTotal(product.amountMinor, currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {stripe?.enabled && stripe.publishableKey ? (
                  stripeSession ? (
                    <StripeContributionCheckout
                      key={stripeSession.clientSecret}
                      amountMinor={stripeSession.amountMinor}
                      clientSecret={stripeSession.clientSecret}
                      connectedAccountId={stripeSession.connectedAccountId}
                      currency={stripe.currency}
                      publishableKey={stripe.publishableKey}
                      requiresShipping={
                        getSupportProduct(stripeSession.amountMinor)
                          ?.requiresShipping ?? false
                      }
                      returnUrl={stripeSession.returnUrl}
                      onConfirmed={verifyStripeContribution}
                      onError={setError}
                    />
                  ) : (
                    <button
                      type="button"
                      disabled={isStartingCheckout}
                      onClick={() => void beginStripeCheckout()}
                      aria-label={
                        isStartingCheckout
                          ? "Starting secure checkout"
                          : "Continue with card or wallet"
                      }
                      className="support-primary-action min-h-11 px-4 py-2 text-sm font-bold uppercase transition-colors disabled:cursor-wait disabled:opacity-55"
                    >
                      {isStartingCheckout ? "…" : "💳 Card / wallet"}
                    </button>
                  )
                ) : (
                  <p className="support-subtle-panel m-0 px-3 py-2 text-center text-xs text-[color:color-mix(in_oklch,var(--color-white)_58%,transparent)]">
                    Card and wallet checkout is not configured yet.
                  </p>
                )}

                {paypal?.enabled && paypal.clientId ? (
                  <div className="border-t border-[color:color-mix(in_oklch,var(--color-neon-teal)_24%,transparent)] pt-3">
                    <button
                      type="button"
                      className="support-secondary-action mx-auto block min-h-11 w-full px-4 py-2 text-sm font-bold transition-colors"
                      onClick={() =>
                        setShowAlternativePayments((value) => !value)
                      }
                      aria-expanded={showAlternativePayments}
                    >
                      {showAlternativePayments ? "Hide" : "Use"} PayPal or Venmo
                    </button>
                    {showAlternativePayments ? (
                      <div className="mt-3">
                        <PayPalContributionCheckout
                          amountMinor={amountMinor}
                          clientId={paypal.clientId}
                          currency={paypal.currency}
                          perspectiveId={perspective.id}
                          onConfirmed={applyStats}
                          onError={setError}
                          onStatus={setStatus}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {status ? (
          <output
            className="absolute top-0 left-full ml-2 w-48 text-left text-xs text-emerald-200"
            aria-live="polite"
          >
            {status}
          </output>
        ) : null}
        {error ? (
          <output
            className="absolute top-0 left-full ml-2 w-48 text-left text-xs text-red-200"
            aria-live="polite"
          >
            {error}
          </output>
        ) : null}
      </div>
    </section>
  );
};
