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
    description: "Three full fitment checks. Same report you’ll get after you pay.",
    features: ["3 full fitment checks", "Clearance, trim, and drivability", "Matched against verified builds"]
  },
  {
    key: "premium",
    name: "More Checks",
    price: "$14",
    interval: " one-time",
    description: "Keep checking after the free ones are used.",
    features: ["2 more full fitment checks", "Same report as the free checks", "Browse the verified builds library"]
  }
] as const;
