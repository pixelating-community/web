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
  getSupportTier,
  SUPPORT_CURRENCY,
  SUPPORT_TIERS,
  type PerspectiveSupportStats,
} from "@/lib/perspectiveSupport";
import type { Perspective } from "@/types/perspectives";

type SupportData = PerspectiveSupportStats & {
  maxAmountMinor: number;
  minAmountMinor: number;
  providers: {
    paypal: {
      clientId: string | null;
      currency: string;
      enabled: boolean;
      environment: "live" | "sandbox";
    };
    stripe: {
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
  const [amountMinor, setAmountMinor] = useState(300);
  const [showContribution, setShowContribution] = useState(false);
  const [showSupportInfo, setShowSupportInfo] = useState(false);
  const [showAlternativePayments, setShowAlternativePayments] = useState(false);
  const [stripeSession, setStripeSession] = useState<StripeSession | null>(null);
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
      setError(reason instanceof Error ? reason.message : "Could not add vote.");
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

  const beginStripeCheckout = async () => {
    const stripe = support?.providers.stripe;
    if (!support || !stripe?.enabled || !stripe.publishableKey) {
      setError("Card checkout is not configured yet.");
      return;
    }
    if (!getSupportTier(amountMinor)) {
      setError("Choose Three Dream or Handwritten Copy.");
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
  const amountLocked = Boolean(stripeSession || isStartingCheckout);
  const selectedTier = getSupportTier(amountMinor) ?? SUPPORT_TIERS[0];

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
              <span aria-hidden="true">
                {support?.hasVoted ? "♥" : "♡"}
              </span>
              <span>{virtualVoteCount}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowSupportInfo(false);
                setShowContribution((value) => !value);
              }}
              className="inline-flex min-h-7 items-center gap-1 whitespace-nowrap border-0 bg-transparent px-1 text-[10px] leading-none text-white/45 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 hover:text-amber-100"
              aria-expanded={showContribution}
              aria-label={`Support this story. ${formatContributionTotal(contributionTotalMinor, currency)} backed.`}
            >
              <span aria-hidden="true">💰</span>
              <span>{formatContributionTotal(contributionTotalMinor, currency)}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowContribution(false);
              setShowSupportInfo((value) => !value);
            }}
            aria-controls="support-info"
            aria-expanded={showSupportInfo}
            aria-label="About votes and support"
            title="About votes and support"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center border-0 bg-transparent text-sm text-white/45 transition-colors hover:text-white"
          >
            <span aria-hidden="true">ⅈ</span>
          </button>
        </div>

        {showSupportInfo ? (
          <aside
            id="support-info"
            className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50 mx-auto w-auto max-w-sm space-y-1 bg-black/90 p-4 text-[11px] leading-relaxed text-white/70 backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => setShowSupportInfo(false)}
              aria-label="Close support information"
              title="Close"
              className="float-right inline-flex h-7 w-7 items-center justify-center border-0 bg-transparent text-base text-white/65 hover:text-white"
            >
              ×
            </button>
            <p className="m-0">♡ Virtual vote. No charge.</p>
            <p className="m-0">💰 Completed payments.</p>
            <p className="m-0">
              Payments purchase the selected tier. They do not buy ownership or
              guarantee a journey or date.
            </p>
            <p className="m-0">
              $25 Handwritten Copy is mailed to your checkout address.
            </p>
          </aside>
        ) : null}

        {showContribution ? (
          <div className="scrollbar-transparent fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),1rem)] z-50 mx-auto flex max-h-[calc(100dvh-2rem)] w-auto max-w-sm flex-col gap-3 overflow-y-auto bg-black/90 p-4 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setShowContribution(false)}
              aria-label="Close support options"
              title="Close"
              className="ml-auto inline-flex h-7 w-7 items-center justify-center border-0 bg-transparent text-base text-white/65 hover:text-white"
            >
              ×
            </button>
            {stripeSession ? (
              <div className="flex items-center justify-between bg-white/5 px-3 py-2 text-sm text-white/75">
                <span>
                  {selectedTier.name} — {formatContributionTotal(amountMinor, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStripeSession(null);
                    setError("");
                  }}
                  aria-label="Change support tier"
                  title="Change support tier"
                  className="text-base text-amber-100"
                >
                  ↺
                </button>
              </div>
            ) : (
              <div
                className="grid grid-cols-2 gap-2"
                aria-label="Story tier"
              >
                {SUPPORT_TIERS.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    disabled={amountLocked}
                    onClick={() => setAmountMinor(tier.amountMinor)}
                    className={`flex min-h-20 flex-col items-start justify-between border px-3 py-2 text-left transition-colors ${
                      amountMinor === tier.amountMinor
                        ? "border-amber-200/50 bg-amber-300/20 text-amber-50"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-xs font-bold uppercase leading-tight">
                      {tier.name}
                    </span>
                    <span className="text-lg font-black">
                      {formatContributionTotal(tier.amountMinor, currency)}
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
                  currency={stripe.currency}
                  publishableKey={stripe.publishableKey}
                  requiresShipping={
                    getSupportTier(stripeSession.amountMinor)?.requiresShipping ??
                    false
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
                  className="min-h-11 border border-amber-200/40 bg-amber-300/20 px-4 py-2 text-sm font-bold uppercase text-amber-50 transition-colors hover:bg-amber-300/25 disabled:cursor-wait disabled:opacity-55"
                >
                  {isStartingCheckout
                    ? "…"
                    : "💳 Card / wallet"}
                </button>
              )
            ) : (
              <p className="m-0 bg-white/5 px-3 py-2 text-center text-xs text-white/55">
                Card and wallet checkout is not configured yet.
              </p>
            )}

            {paypal?.enabled && paypal.clientId ? (
              <div className="border-t border-white/10 pt-3">
                <button
                  type="button"
                  className="mx-auto block text-xs text-white/55 underline decoration-white/20 underline-offset-4 hover:text-white/75"
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
