"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateCredits } from "@/src/lib/credits";

type CreditEstimateProps = {
  photoCount: number;
  modTags: string[];
  unlimited?: boolean;
  initialBalance?: number | null;
  initialSignedIn?: boolean;
  onCanAffordChange?: (canAfford: boolean) => void;
};

export function CreditEstimate({
  photoCount,
  modTags,
  unlimited = false,
  initialBalance = null,
  initialSignedIn = false,
  onCanAffordChange
}: CreditEstimateProps) {
  const requiredCredits = useMemo(
    () => calculateCredits({ photoCount, modTags }),
    [photoCount, modTags]
  );
  const [balance, setBalance] = useState<number | null>(initialBalance);
  const [signedIn, setSignedIn] = useState(initialSignedIn);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      try {
        const response = await fetch("/api/credits/me", { cache: "no-store" });
        const payload = (await response.json()) as {
          signedIn?: boolean;
          balance?: number | null;
        };

        if (cancelled) return;

        if (!response.ok || !payload.signedIn) {
          setSignedIn(false);
          setBalance(null);
          return;
        }

        setSignedIn(true);
        setBalance(typeof payload.balance === "number" ? payload.balance : 0);
      } catch (error) {
        console.error("Reading credit balance failed", error);
        if (!cancelled) setBalance((current) => current);
      }
    }

    void loadBalance();
    const onFocus = () => {
      void loadBalance();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const shortOnCredits = !unlimited && signedIn && balance !== null && balance < requiredCredits;
  const canAfford = !shortOnCredits;

  useEffect(() => {
    onCanAffordChange?.(canAfford);
  }, [canAfford, onCanAffordChange]);

  return (
    <div className={`check-credit-estimate${shortOnCredits ? " is-short" : ""}`}>
      <p className="check-credit-cost">This will cost {requiredCredits} credits.</p>
      {unlimited ? (
        <p>Admin checks are unlimited.</p>
      ) : signedIn && balance !== null ? (
        <p>You have {balance} {balance === 1 ? "credit" : "credits"}.</p>
      ) : signedIn ? (
        <p>Checking your credit balance…</p>
      ) : (
        <p>Sign in to get 12 free credits.</p>
      )}
      {shortOnCredits ? (
        <p className="check-credit-short">
          Not enough credits — you have {balance} and this costs {requiredCredits}.
        </p>
      ) : null}
    </div>
  );
}
