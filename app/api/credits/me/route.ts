import { NextResponse } from "next/server";
import { ensureStartingCredits, getSpendableCreditBalance } from "@/lib/spendableCredits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json({ signedIn: false, balance: null, priority: false });
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) {
    return NextResponse.json({ signedIn: false, balance: null, priority: false });
  }

  const admin = createSupabaseAdminClient();
  await ensureStartingCredits(admin, currentUser.userId);
  const wallet = await getSpendableCreditBalance(admin, currentUser.userId);

  return NextResponse.json({
    signedIn: true,
    balance: wallet.balance,
    priority: wallet.priority
  });
}
