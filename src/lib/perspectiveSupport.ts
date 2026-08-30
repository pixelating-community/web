export const SUPPORT_CURRENCY = "USD";

export const SUPPORT_TIERS = [
  {
    amountMinor: 300,
    description: "Three Dream story contribution for this perspective.",
    id: "three-dream",
    name: "Three Dream",
    requiresShipping: false,
  },
  {
    amountMinor: 2500,
    description: "One physical handwritten copy of this story, mailed to the checkout address.",
    id: "handwritten-copy",
    name: "Handwritten Copy",
    requiresShipping: true,
  },
] as const;

export const SUPPORT_MIN_AMOUNT_MINOR = SUPPORT_TIERS[0].amountMinor;
export const SUPPORT_MAX_AMOUNT_MINOR = SUPPORT_TIERS[1].amountMinor;

export const getSupportTier = (amountMinor: number) =>
  SUPPORT_TIERS.find((tier) => tier.amountMinor === amountMinor) ?? null;

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
