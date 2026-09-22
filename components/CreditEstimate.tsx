"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateCredits } from "@/src/lib/credits";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type CreditEstimateProps = {
  photoCount: number;
  modTags: string[];
  unlimited?: boolean;
  onCanAffordChange?: (canAfford: boolean) => void;
};

export function CreditEstimate({
  photoCount,
  modTags,
  unlimited = false,
  onCanAffordChange
}: CreditEstimateProps) {
  const requiredCredits = useMemo(
    () => calculateCredits({ photoCount, modTags }),
    [photoCount, modTags]
  );
  const [balance, setBalance] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      const supabase = createSupabaseBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;

      if (!user) {
        if (!cancelled) {
          setSignedIn(false);
          setBalance(null);
        }
        return;
      }

      const { data, error } = await supabase
        .from("credit_balances")
        .select("balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Reading credit_balances.balance failed", error);
        setSignedIn(true);
        setBalance(null);
        return;
      }

      setSignedIn(true);
      setBalance(typeof data?.balance === "number" ? data.balance : 0);
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
