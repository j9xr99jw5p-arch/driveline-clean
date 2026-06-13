export const planLimits = {
  free: { fitment_check_limit: 3 },
  builder: { fitment_check_limit: 999999 }
} as const;

export const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    interval: "",
    description: "Browse verified builds and run a few fitment checks.",
    features: ["3 fitment checks", "Verified build library", "Basic fitment report"]
  },
  {
    key: "builder",
    name: "Builder Plus",
    price: "$12",
    interval: "/month",
    description: "Full access to Driveline Auto and every Tacoma fitment feature.",
    features: ["Full access to all features", "Unlimited fitment planning", "Account billing tools"]
  }
] as const;
