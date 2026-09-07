export const SUPPORT_CURRENCY = "USD";
export const SUPPORT_DEFAULT_AMOUNT_MINOR = 300;
export const SUPPORT_MIN_AMOUNT_MINOR = 100;

export const isValidContributionAmount = (amountMinor: number) =>
  Number.isSafeInteger(amountMinor) && amountMinor >= SUPPORT_MIN_AMOUNT_MINOR;

export const parseContributionAmount = (value: string) => {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return isValidContributionAmount(amountMinor) ? amountMinor : null;
};

export type PerspectiveSupportStats = {
  contributionCurrency: string;
  contributionTotalMinor: number;
  hasVoted: boolean;
  virtualVoteCount: number;
};

export const coerceSupportCount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
};

export const formatContributionTotal = (
  amountMinor: number,
  currency = SUPPORT_CURRENCY,
) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(coerceSupportCount(amountMinor) / 100);

export const formatPayPalAmount = (amountMinor: number) =>
  (coerceSupportCount(amountMinor) / 100).toFixed(2);
