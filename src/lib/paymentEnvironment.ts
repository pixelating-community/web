export type PaymentEnvironment = "live" | "sandbox";

export const isLivePaymentsEnabled = (value: string | undefined) =>
  ["1", "true", "yes"].includes(value?.trim().toLowerCase() ?? "");

export const isPaymentEnvironmentAllowed = ({
  environment,
  livePaymentsEnabled,
}: {
  environment: PaymentEnvironment | null;
  livePaymentsEnabled: boolean;
}) =>
  environment === "sandbox" ||
  (environment === "live" && livePaymentsEnabled);

const normalizeEnvironmentValue = (value: string | undefined) =>
  value?.trim().toLowerCase() || undefined;

export const resolvePayPalEnvironment = (
  value: string | undefined,
): PaymentEnvironment | null => {
  const normalized = normalizeEnvironmentValue(value);
  if (!normalized) return "sandbox";
  if (normalized === "live" || normalized === "sandbox") return normalized;
  return null;
};

const resolveStripeKeyEnvironment = (
  key: string | undefined,
  livePrefix: string,
  testPrefix: string,
): PaymentEnvironment | null => {
  if (key?.startsWith(livePrefix)) return "live";
  if (key?.startsWith(testPrefix)) return "sandbox";
  return null;
};

export const resolveStripeEnvironment = ({
  publishableKey,
  secretKey,
}: {
  publishableKey: string | undefined;
  secretKey: string | undefined;
}): PaymentEnvironment | null => {
  const publishableEnvironment = resolveStripeKeyEnvironment(
    publishableKey,
    "pk_live_",
    "pk_test_",
  );
  const secretEnvironment = resolveStripeKeyEnvironment(
    secretKey,
    "sk_live_",
    "sk_test_",
  );
  if (!publishableEnvironment || publishableEnvironment !== secretEnvironment) {
    return null;
  }
  return publishableEnvironment;
};
