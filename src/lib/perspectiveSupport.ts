export const SUPPORT_CURRENCY = "USD";

export const SUPPORT_PRODUCTS = [
  {
    amountMinor: 300,
    description:
      "A personal digital copy of this story, delivered by email within 2 business days.",
    fulfillment:
      "Delivered to the email used at checkout within 2 business days.",
    id: "digital-story",
    name: "Digital Story",
    requiresShipping: false,
  },
  {
    amountMinor: 2500,
    description:
      "One handwritten copy of this story, mailed to the shipping address entered at checkout.",
    fulfillment:
      "Ships to the address entered at checkout within 10 business days.",
    id: "handwritten-copy",
    name: "Handwritten Copy",
    requiresShipping: true,
  },
] as const;

export type SupportProduct = (typeof SUPPORT_PRODUCTS)[number];
export type SupportProductId = SupportProduct["id"];

export const SUPPORT_MIN_AMOUNT_MINOR = SUPPORT_PRODUCTS[0].amountMinor;
export const SUPPORT_MAX_AMOUNT_MINOR = SUPPORT_PRODUCTS[1].amountMinor;

export const getSupportProduct = (amountMinor: number) =>
  SUPPORT_PRODUCTS.find((product) => product.amountMinor === amountMinor) ??
  null;

export const getSupportProductById = (id: string | null | undefined) =>
  SUPPORT_PRODUCTS.find((product) => product.id === id) ?? null;

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
