"use client";

import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  ShippingAddressElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import {
  loadStripe,
  type Stripe,
  type StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js";
import { type FormEvent, useCallback, useState } from "react";
import { formatContributionTotal } from "@/lib/perspectiveSupport";

const stripePromises = new Map<string, Promise<Stripe | null>>();

const getStripe = (publishableKey: string) => {
  const existing = stripePromises.get(publishableKey);
  if (existing) return existing;
  const promise = loadStripe(publishableKey);
  stripePromises.set(publishableKey, promise);
  return promise;
};

type StripeContributionCheckoutProps = {
  amountMinor: number;
  clientSecret: string;
  currency: string;
  onConfirmed: (sessionId: string) => Promise<void>;
  onError: (message: string) => void;
  publishableKey: string;
  requiresShipping: boolean;
  returnUrl: string;
};

const StripeCheckoutForm = ({
  amountMinor,
  currency,
  onConfirmed,
  onError,
  requiresShipping,
  returnUrl,
}: Omit<
  StripeContributionCheckoutProps,
  "clientSecret" | "publishableKey"
>) => {
  const checkoutState = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [expressAvailable, setExpressAvailable] = useState(false);

  const confirm = useCallback(
    async (expressCheckoutConfirmEvent?: StripeExpressCheckoutElementConfirmEvent) => {
      if (checkoutState.type !== "success" || busy) return;
      setBusy(true);
      onError("");
      try {
        const result = await checkoutState.checkout.confirm({
          expressCheckoutConfirmEvent,
          redirect: "if_required",
          returnUrl,
        });
        if (result.type === "error") {
          expressCheckoutConfirmEvent?.paymentFailed({
            message: result.error.message,
          });
          onError(result.error.message);
          return;
        }
        await onConfirmed(result.session.id);
      } catch (reason) {
        const message =
          reason instanceof Error
            ? reason.message
            : "The payment could not be confirmed.";
        expressCheckoutConfirmEvent?.paymentFailed({ message });
        onError(message);
      } finally {
        setBusy(false);
      }
    }, [busy, checkoutState, onConfirmed, onError, returnUrl],
  );

  if (checkoutState.type === "loading") {
    return (
      <p className="m-0 rounded-lg bg-white/5 px-3 py-3 text-center text-xs text-white/55">
        Loading secure checkout…
      </p>
    );
  }

  if (checkoutState.type === "error") {
    return (
      <p className="m-0 rounded-lg bg-red-400/10 px-3 py-3 text-center text-xs text-red-100">
        {checkoutState.error.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={expressAvailable ? "block" : "hidden"}>
        <ExpressCheckoutElement
          onReady={(event) =>
            setExpressAvailable(
              Boolean(
                event.availablePaymentMethods &&
                  Object.values(event.availablePaymentMethods).some(Boolean),
              ),
            )
          }
          onConfirm={(event) => void confirm(event)}
        />
      </div>
      {expressAvailable ? (
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-white/35">
          <span className="h-px flex-1 bg-white/10" />
          <span>or enter payment details</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void confirm();
        }}
      >
        {requiresShipping ? <ShippingAddressElement /> : null}
        <PaymentElement options={{ layout: "accordion" }} />
        <button
          type="submit"
          disabled={busy || !checkoutState.checkout.canConfirm}
          className="min-h-11 rounded-xl border border-amber-200/40 bg-amber-300/20 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/25 disabled:cursor-wait disabled:opacity-55"
        >
          {busy
            ? "Confirming…"
            : `Pay ${formatContributionTotal(amountMinor, currency)} securely`}
        </button>
      </form>
    </div>
  );
};

export const StripeContributionCheckout = (
  props: StripeContributionCheckoutProps,
) => (
  <CheckoutElementsProvider
    stripe={getStripe(props.publishableKey)}
    options={{
      clientSecret: props.clientSecret,
      elementsOptions: {
        appearance: {
          theme: "night",
          variables: {
            borderRadius: "10px",
            colorBackground: "#171717",
            colorPrimary: "#fde68a",
            colorText: "#ffffff",
          },
        },
      },
    }}
  >
    <StripeCheckoutForm {...props} />
  </CheckoutElementsProvider>
);
