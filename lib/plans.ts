export const planLimits = {
  free: { fitment_check_limit: 3 },
  paid: { fitment_check_limit: 3 },
  builder: { fitment_check_limit: 3 }
} as const;

export const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    interval: "",
    description: "Run a few basic fitment checks before you commit to a setup.",
    features: ["3 basic fitment checks", "Clearance risk label", "Short conservative verdict"]
  },
  {
    key: "premium",
    name: "Premium Checks",
    price: "$14",
    interval: " one-time",
    description: "Two full AI fitment reports when you want a deeper answer.",
    features: ["2 full AI fitment reports", "What to change before you buy", "Verified Builds access"]
  }
] as const;
