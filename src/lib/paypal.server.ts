import "@tanstack/react-start/server-only";
import { getServerEnv } from "@/lib/env.server";
import { resolvePayPalEnvironment } from "@/lib/paymentEnvironment";
import {
  formatPayPalAmount,
  getSupportTier,
  SUPPORT_CURRENCY,
} from "@/lib/perspectiveSupport";

type PayPalConfig = {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  environment: "live" | "sandbox";
};

type PayPalCapture = {
  amount?: { currency_code?: string; value?: string };
  id?: string;
  status?: string;
};

type PayPalOrder = {
  details?: Array<{ description?: string; issue?: string }>;
  id?: string;
  purchase_units?: Array<{
    payments?: { captures?: PayPalCapture[] };
  }>;
  status?: string;
};

export class PayPalRequestError extends Error {
  issue?: string;

  constructor(message: string, issue?: string) {
    super(message);
    this.name = "PayPalRequestError";
    this.issue = issue;
  }
}

const resolveEnvironment = () =>
  resolvePayPalEnvironment(getServerEnv("PAYPAL_ENVIRONMENT"));

export const getPayPalPublicConfig = () => {
  const clientId = getServerEnv("PAYPAL_CLIENT_ID");
  const environment = resolveEnvironment();
  const webhookConfigured = Boolean(getServerEnv("PAYPAL_WEBHOOK_ID"));
  return {
    clientId: clientId ?? null,
    currency: SUPPORT_CURRENCY,
    enabled: Boolean(
      clientId &&
        getServerEnv("PAYPAL_CLIENT_SECRET") &&
        environment &&
        (process.env.NODE_ENV !== "production" || webhookConfigured),
    ),
    environment: environment ?? "sandbox",
  };
};

const getPayPalConfig = (): PayPalConfig => {
  const clientId = getServerEnv("PAYPAL_CLIENT_ID");
  const clientSecret = getServerEnv("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("PayPal contributions are not configured.");
  }
  const environment = resolveEnvironment();
  if (!environment) {
    throw new Error("PAYPAL_ENVIRONMENT must be sandbox or live.");
  }
  return {
    apiBaseUrl:
      environment === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com",
    clientId,
    clientSecret,
    environment,
  };
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const body = (await response.json().catch(() => ({}))) as T & PayPalOrder;
  if (!response.ok) {
    const detail = body.details?.[0];
    throw new PayPalRequestError(
      detail?.description ?? `PayPal request failed (${response.status}).`,
      detail?.issue,
    );
  }
  return body;
};

const getAccessToken = async (config: PayPalConfig) => {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");
  const response = await fetch(`${config.apiBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await parseResponse<{ access_token?: string }>(response);
  if (!body.access_token) throw new Error("PayPal did not return an access token.");
  return body.access_token;
};

const requestPayPal = async <T>({
  body,
  method = "GET",
  path,
  requestId,
}: {
  body?: unknown;
  method?: "GET" | "POST";
  path: string;
  requestId?: string;
}) => {
  const config = getPayPalConfig();
  const accessToken = await getAccessToken(config);
  const headers = new Headers({
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  });
  if (requestId) headers.set("PayPal-Request-Id", requestId);
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(response);
};

export const createPayPalOrder = async ({
  amountMinor,
  contributionId,
}: {
  amountMinor: number;
  contributionId: string;
}) => {
  const tier = getSupportTier(amountMinor);
  if (!tier) throw new Error("Unknown story support tier.");
  const formattedAmount = formatPayPalAmount(amountMinor);
  const order = await requestPayPal<PayPalOrder>({
    method: "POST",
    path: "/v2/checkout/orders",
    requestId: contributionId,
    body: {
      application_context: {
        shipping_preference: tier.requiresShipping
          ? "GET_FROM_FILE"
          : "NO_SHIPPING",
      },
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: contributionId,
          custom_id: contributionId,
          description: tier.description,
          amount: {
            currency_code: SUPPORT_CURRENCY,
            value: formattedAmount,
            ...(tier.requiresShipping
              ? {
                  breakdown: {
                    item_total: {
                      currency_code: SUPPORT_CURRENCY,
                      value: formattedAmount,
                    },
                  },
                }
              : {}),
          },
          ...(tier.requiresShipping
            ? {
                items: [
                  {
                    name: tier.name,
                    description: tier.description,
                    quantity: "1",
                    category: "PHYSICAL_GOODS",
                    unit_amount: {
                      currency_code: SUPPORT_CURRENCY,
                      value: formattedAmount,
                    },
                  },
                ],
              }
            : {}),
        },
      ],
    },
  });
  if (!order.id) throw new Error("PayPal did not return an order ID.");
  return order.id;
};

export const capturePayPalOrder = (orderId: string, requestId: string) =>
  requestPayPal<PayPalOrder>({
    method: "POST",
    path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    requestId,
  });

export const getPayPalOrder = (orderId: string) =>
  requestPayPal<PayPalOrder>({
    path: `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
  });

export const verifyPayPalWebhookSignature = async ({
  event,
  headers,
}: {
  event: unknown;
  headers: Headers;
}) => {
  const webhookId = getServerEnv("PAYPAL_WEBHOOK_ID");
  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is not configured.");
  }
  const requiredHeader = (name: string) => {
    const value = headers.get(name)?.trim();
    if (!value) throw new Error(`Missing PayPal webhook header: ${name}`);
    return value;
  };
  const result = await requestPayPal<{ verification_status?: string }>({
    method: "POST",
    path: "/v1/notifications/verify-webhook-signature",
    body: {
      auth_algo: requiredHeader("paypal-auth-algo"),
      cert_url: requiredHeader("paypal-cert-url"),
      transmission_id: requiredHeader("paypal-transmission-id"),
      transmission_sig: requiredHeader("paypal-transmission-sig"),
      transmission_time: requiredHeader("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    },
  });
  return result.verification_status === "SUCCESS";
};

export const readCompletedPayPalCapture = (order: PayPalOrder) => {
  const capture = order.purchase_units?.flatMap(
    (unit) => unit.payments?.captures ?? [],
  ).find((candidate) => candidate.status === "COMPLETED");
  if (!capture?.id || !capture.amount?.currency_code || !capture.amount.value) {
    return null;
  }
  const amountMinor = Math.round(Number(capture.amount.value) * 100);
  if (!Number.isSafeInteger(amountMinor)) return null;
  return {
    amountMinor,
    captureId: capture.id,
    currency: capture.amount.currency_code,
  };
};
