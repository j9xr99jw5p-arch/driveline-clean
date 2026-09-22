export const FREE_STARTING_CREDITS = 12;

export const creditPackKeys = ["credits_50", "credits_150", "priority"] as const;
export type CreditPackKey = (typeof creditPackKeys)[number];

export type CreditPack = {
  key: CreditPackKey;
  name: string;
  credits: number;
  priceLabel: string;
  intervalLabel: string;
  description: string;
  features: string[];
  mode: "payment" | "subscription";
  defaultPriceId: string;
  envKey: string;
  entitlementKey: string;
  priority: boolean;
};

export const creditPacks: Record<CreditPackKey, CreditPack> = {
  credits_50: {
    key: "credits_50",
    name: "Starter Credits",
    credits: 50,
    priceLabel: "$4.99",
    intervalLabel: " one-time",
    description: "A small pack to keep checking and rendering.",
    features: ["50 credits", "Same full fitment report", "Verified builds library"],
    mode: "payment",
    defaultPriceId: "price_1UIHFQAxOgxntpwRlocHgdap",
    envKey: "STRIPE_CREDITS_50_PRICE_ID",
    entitlementKey: "credits_50",
    priority: false
  },
  credits_150: {
    key: "credits_150",
    name: "Plus Credits",
    credits: 150,
    priceLabel: "$14.99",
    intervalLabel: " one-time",
    description: "More credits for bigger visualization jobs.",
    features: ["150 credits", "Same full fitment report", "Verified builds library"],
    mode: "payment",
    defaultPriceId: "price_1UIHC6AxOgxntpwRt1gaVjOf",
    envKey: "STRIPE_CREDITS_150_PRICE_ID",
    entitlementKey: "credits_150",
    priority: false
  },
  priority: {
    key: "priority",
    name: "Priority",
    credits: 250,
    priceLabel: "$25",
    intervalLabel: "/month",
    description: "250 credits every month, plus priority service.",
    features: ["250 credits each month", "Priority service", "Verified builds library"],
    mode: "subscription",
    defaultPriceId: "price_1UIHHGAxOgxntpwRiLkQNDRG",
    envKey: "STRIPE_PRIORITY_MONTHLY_PRICE_ID",
    entitlementKey: "priority_monthly",
    priority: true
  }
};

export const oneTimeCreditPacks = [creditPacks.credits_50, creditPacks.credits_150];
export const subscriptionCreditPacks = [creditPacks.priority];

export function isCreditPackKey(value: unknown): value is CreditPackKey {
  return typeof value === "string" && creditPackKeys.includes(value as CreditPackKey);
}

export function getCreditPack(key: CreditPackKey) {
  return creditPacks[key];
}

export function getCreditPackPriceId(pack: CreditPack) {
  const configured = process.env[pack.envKey]?.trim();
  return configured || pack.defaultPriceId;
}

export function listConfiguredOneTimePriceIds() {
  return oneTimeCreditPacks.map(getCreditPackPriceId).filter(Boolean);
}

export function findCreditPackByPriceId(priceId: string | null | undefined) {
  if (!priceId) return null;
  return Object.values(creditPacks).find((pack) => getCreditPackPriceId(pack) === priceId) ?? null;
}

export function findCreditPackByEntitlementKey(value: string | null | undefined) {
  if (!value) return null;
  return Object.values(creditPacks).find((pack) => pack.entitlementKey === value) ?? null;
}
