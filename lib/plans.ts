import { creditPacks, FREE_STARTING_CREDITS } from "@/lib/creditPacks";

export const planLimits = {
  free: { fitment_check_limit: 3 },
  paid: { fitment_check_limit: 3 },
  builder: { fitment_check_limit: 3 }
} as const;

export const plans = [
  {
    key: "free",
    name: "Free",
    pack: null,
    price: "$0",
    interval: "",
    description: `${FREE_STARTING_CREDITS} credits when you sign in. Same report you’ll get after you pay.`,
    features: [`${FREE_STARTING_CREDITS} starting credits`, "Clearance, trim, and drivability", "Matched against verified builds"]
  },
  {
    key: creditPacks.credits_50.key,
    name: creditPacks.credits_50.name,
    pack: creditPacks.credits_50.key,
    price: creditPacks.credits_50.priceLabel,
    interval: creditPacks.credits_50.intervalLabel,
    description: creditPacks.credits_50.description,
    features: creditPacks.credits_50.features
  },
  {
    key: creditPacks.credits_150.key,
    name: creditPacks.credits_150.name,
    pack: creditPacks.credits_150.key,
    price: creditPacks.credits_150.priceLabel,
    interval: creditPacks.credits_150.intervalLabel,
    description: creditPacks.credits_150.description,
    features: creditPacks.credits_150.features
  },
  {
    key: creditPacks.priority.key,
    name: creditPacks.priority.name,
    pack: creditPacks.priority.key,
    price: creditPacks.priority.priceLabel,
    interval: creditPacks.priority.intervalLabel,
    description: creditPacks.priority.description,
    features: creditPacks.priority.features
  }
] as const;
