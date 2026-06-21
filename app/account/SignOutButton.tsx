"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out failed", error);
      setIsSigningOut(false);
      return;
    }

    router.refresh();
  }

  return (
    <button className="button full" type="button" onClick={signOut} disabled={isSigningOut}>
      {isSigningOut ? "Signing Out..." : "Log Out"}
    </button>
  );
}
