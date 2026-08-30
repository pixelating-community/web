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
      className="relative z-10 border-t border-white/10 bg-black/55 px-4 py-6 backdrop-blur-md"
    >
      <div className="mr-auto flex w-full max-w-3xl flex-col items-start gap-4">
        <div className="flex w-fit max-w-full flex-col items-start gap-0.5 bg-black/20 px-2 py-1.5 text-left">
          <span
            aria-hidden="true"
            className="px-1 text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-white/65 [text-shadow:2px_2px_0_rgba(0,0,0,0.95)]"
          >
            Support this story
          </span>
          <button
            type="button"
            onClick={() => void handleVote()}
            disabled={isVoting || support?.hasVoted}
            className={`group inline-flex min-h-11 w-full items-center justify-start gap-2 px-1 py-1 text-left text-base font-black uppercase leading-none tracking-[-0.035em] transition [text-shadow:2px_2px_0_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 enabled:hover:translate-x-1 ${
              support?.hasVoted
                ? "text-pink-100"
                : "text-white hover:text-pink-100"
            }`}
          >
            <span>{virtualVoteCount} virtual votes</span>
            <span aria-hidden="true">
              {support?.hasVoted ? "♥" : "♡"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setShowContribution((value) => !value)}
            className="group inline-flex min-h-11 w-full items-center justify-start gap-2 px-1 py-1 text-left text-base font-black uppercase italic leading-none tracking-[-0.035em] text-white transition [text-shadow:2px_2px_0_rgba(0,0,0,0.95),0_0_4px_rgba(0,0,0,0.8)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 hover:translate-x-1 hover:text-amber-100"
            aria-expanded={showContribution}
          >
            <span>
              {formatContributionTotal(contributionTotalMinor, currency)} backed
            </span>
            <span aria-hidden="true" className="not-italic">
              ✦
            </span>
          </button>
        </div>

        {showContribution ? (
          <div className="mr-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-white/10 bg-black/35 p-4">
            <p className="m-0 text-center text-sm text-white/80">
              Choose a tier.
            </p>

            {stripeSession ? (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
                <span>
                  {selectedTier.name} — {formatContributionTotal(amountMinor, currency)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStripeSession(null);
                    setError("");
                  }}
                  className="text-xs text-amber-100 underline decoration-amber-200/40 underline-offset-2"
                >
                  Change
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
                    className={`flex min-h-20 flex-col items-start justify-between rounded-lg border px-3 py-2 text-left transition ${
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
                  className="min-h-11 rounded-xl border border-amber-200/40 bg-amber-300/20 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/25 disabled:cursor-wait disabled:opacity-55"
                >
                  {isStartingCheckout
                    ? "Starting secure checkout…"
                    : "Continue with card or wallet"}
                </button>
              )
            ) : (
              <p className="m-0 rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-white/55">
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

            <p className="m-0 text-center text-[11px] leading-relaxed text-white/45">
              $25 Handwritten Copy is mailed to your checkout address.
            </p>
          </div>
        ) : null}

        {status ? (
          <output
            className="w-full max-w-sm text-left text-xs text-emerald-200"
            aria-live="polite"
          >
            {status}
          </output>
        ) : null}
        {error ? (
          <output
            className="w-full max-w-sm text-left text-xs text-red-200"
            aria-live="polite"
          >
            {error}
          </output>
        ) : null}
      </div>
    </section>
  );
};
