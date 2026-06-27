import "server-only";
import { formatCents } from "@/lib/products";
import { getStripe } from "@/lib/stripe";

export type PriceSource = "stripe" | "database" | "unavailable";

export type DisplayPrice = {
  priceCents: number | null;
  priceLabel: string;
  priceSource: PriceSource;
};

type PriceInput = {
  stripePriceId?: string | null;
  priceCents?: number | null;
};

const seededPriceFallbacks: Record<string, number> = {
  price_1TmhBnAxOgxntpwRFSJteEhA: 3999,
  price_1TmhPSAxOgxntpwRI5xmI5Tx: 9499,
  price_1TmhTQAxOgxntpwRhSEY4rtC: 4500,
  price_1TmhWJAxOgxntpwRm4JD7JQw: 16599
};

export async function getStripePriceMap(priceIds: Array<string | null | undefined>) {
  const uniquePriceIds = Array.from(new Set(priceIds.filter((priceId): priceId is string => Boolean(priceId))));
  const priceMap = new Map<string, DisplayPrice>();
  if (!uniquePriceIds.length) return priceMap;

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (error) {
    console.error("Stripe price lookup skipped because Stripe is not configured.", error);
    return priceMap;
  }

  await Promise.all(uniquePriceIds.map(async (priceId) => {
    try {
      const price = await stripe.prices.retrieve(priceId);
      if (typeof price.unit_amount === "number") {
        priceMap.set(priceId, {
          priceCents: price.unit_amount,
          priceLabel: formatCurrency(price.unit_amount, price.currency),
          priceSource: "stripe"
        });
      }
    } catch (error) {
      console.error(`Stripe price lookup failed for ${priceId}`, error);
    }
  }));

  return priceMap;
}

export function resolveDisplayPrice(input: PriceInput, stripePrices: Map<string, DisplayPrice>): DisplayPrice {
  if (input.stripePriceId) {
    const stripePrice = stripePrices.get(input.stripePriceId);
    if (stripePrice) return stripePrice;
  }

  if (typeof input.priceCents === "number" && Number.isFinite(input.priceCents)) {
    return {
      priceCents: input.priceCents,
      priceLabel: formatCents(input.priceCents) ?? "Price unavailable",
      priceSource: "database"
    };
  }

  if (input.stripePriceId && seededPriceFallbacks[input.stripePriceId]) {
    const fallbackCents = seededPriceFallbacks[input.stripePriceId];
    return {
      priceCents: fallbackCents,
      priceLabel: formatCents(fallbackCents) ?? "Price unavailable",
      priceSource: "database"
    };
  }

  return {
    priceCents: null,
    priceLabel: "Price unavailable",
    priceSource: "unavailable"
  };
}

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);
}
