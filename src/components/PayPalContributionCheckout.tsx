"use client";

import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  capturePayPalContributionOrder,
  createPayPalContributionOrder,
} from "@/lib/perspectiveSupport.functions";
import type { PerspectiveSupportStats } from "@/lib/perspectiveSupport";

type PayPalActions = {
  restart: () => Promise<void> | void;
};

type PayPalButtons = {
  close?: () => Promise<void> | void;
  isEligible: () => boolean;
  render: (element: HTMLElement) => Promise<void>;
};

type PayPalButtonOptions = {
  createOrder: () => Promise<string>;
  fundingSource: string;
  onApprove: (
    data: { orderID: string },
    actions: PayPalActions,
  ) => Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
  style?: Record<string, string | number>;
};

type PayPalNamespace = {
  Buttons: (options: PayPalButtonOptions) => PayPalButtons;
  FUNDING: {
    PAYPAL: string;
    VENMO: string;
  };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

const sdkPromises = new Map<string, Promise<PayPalNamespace>>();

const loadPayPalSdk = (clientId: string, currency: string) => {
  const key = `${clientId}:${currency}`;
  const existing = sdkPromises.get(key);
  if (existing) return existing;

  const promise = new Promise<PayPalNamespace>((resolve, reject) => {
    if (window.paypal) {
      resolve(window.paypal);
      return;
    }
    const script = document.createElement("script");
    const query = new URLSearchParams({
      "client-id": clientId,
      components: "buttons",
      currency,
      "enable-funding": "venmo",
    });
    script.src = `https://www.paypal.com/sdk/js?${query.toString()}`;
    script.async = true;
    script.dataset.pxl8Paypal = key;
    script.onload = () => {
      if (window.paypal) resolve(window.paypal);
      else reject(new Error("PayPal checkout did not load."));
    };
    script.onerror = () => reject(new Error("PayPal checkout did not load."));
    document.head.append(script);
  });
  sdkPromises.set(key, promise);
  return promise;
};

export const PayPalContributionCheckout = ({
  amountMinor,
  clientId,
  currency,
  onConfirmed,
  onError,
  onStatus,
  perspectiveId,
}: {
  amountMinor: number;
  clientId: string;
  currency: string;
  onConfirmed: (stats: PerspectiveSupportStats | null) => void;
  onError: (message: string) => void;
  onStatus: (message: string) => void;
  perspectiveId: string;
}) => {
  const createOrderFn = useServerFn(createPayPalContributionOrder);
  const captureOrderFn = useServerFn(capturePayPalContributionOrder);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    const buttonsToClose: PayPalButtons[] = [];
    container.replaceChildren();
    setAvailable(null);
    onError("");

    void loadPayPalSdk(clientId, currency)
      .then(async (paypal) => {
        if (!active) return;
        let eligibleCount = 0;

        for (const fundingSource of [
          paypal.FUNDING.VENMO,
          paypal.FUNDING.PAYPAL,
        ]) {
          const buttons = paypal.Buttons({
            fundingSource,
            style: {
              height: 42,
              layout: "vertical",
              shape: "rect",
            },
            createOrder: async () => {
              onError("");
              onStatus("");
              const result = await createOrderFn({
                data: { amountMinor, perspectiveId },
              });
              if (!result.ok) throw new Error(result.error);
              return result.data.orderId;
            },
            onApprove: async (data, actions) => {
              const result = await captureOrderFn({
                data: { orderId: data.orderID, perspectiveId },
              });
              if (!result.ok) {
                if (result.code === "INSTRUMENT_DECLINED") {
                  await actions.restart();
                  return;
                }
                throw new Error(result.error);
              }
              onConfirmed(result.data);
              onStatus("Payment confirmed.");
            },
            onCancel: () => onStatus("Checkout was canceled."),
            onError: (reason) =>
              onError(
                reason instanceof Error
                  ? reason.message
                  : "PayPal could not complete checkout.",
              ),
          });
          buttonsToClose.push(buttons);
          if (!buttons.isEligible()) continue;

          eligibleCount += 1;
          const target = document.createElement("div");
          container.append(target);
          await buttons.render(target);
        }
        if (active) setAvailable(eligibleCount > 0);
      })
      .catch((reason) => {
        if (!active) return;
        setAvailable(false);
        onError(
          reason instanceof Error
            ? reason.message
            : "PayPal checkout did not load.",
        );
      });

    return () => {
      active = false;
      for (const buttons of buttonsToClose) void buttons.close?.();
      container.replaceChildren();
    };
  }, [
    amountMinor,
    captureOrderFn,
    clientId,
    createOrderFn,
    currency,
    onConfirmed,
    onError,
    onStatus,
    perspectiveId,
  ]);

  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} className="flex min-h-11 flex-col gap-2" />
      {available === false ? (
        <p className="m-0 rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-white/55">
          PayPal and Venmo are not available on this device.
        </p>
      ) : null}
    </div>
  );
};
