"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    const supabase = createSupabaseBrowserClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const emailRedirectTo = `${siteUrl}/auth/callback?next=/account/success`;

    console.log("Magic link redirect:", emailRedirectTo);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo }
    });

    if (error) {
      console.error("Sign-in link request failed", error);
      setStatus("We couldn’t send your sign-in link right now. Please try again shortly.");
      return;
    }

    setStatus("Check your email for the sign-in link.");
  }

  return (
    <form className="card form" onSubmit={onSubmit}>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" required placeholder="you@example.com" />
      </label>
      <button className="button primary full" type="submit">Send Magic Link</button>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
