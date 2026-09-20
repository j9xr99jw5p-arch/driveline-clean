import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ensureFreeUserPlan } from "@/lib/billing";
import { planLimits } from "@/lib/plans";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export const freeFitmentCheckLimit = planLimits.free.fitment_check_limit;
const freeCheckCookieName = "driveline_free_checks";
const freeCheckCookieMaxAgeSeconds = 60 * 60 * 24 * 400;

export type FreeFitmentCheckQuota = {
  limit: number;
  used: number;
  remaining: number;
  canRunFreeCheck: boolean;
};

export function emptyFreeFitmentCheckQuota(): FreeFitmentCheckQuota {
  return {
    limit: freeFitmentCheckLimit,
    used: 0,
    remaining: freeFitmentCheckLimit,
    canRunFreeCheck: true
  };
}

export async function getFreeFitmentCheckQuota(): Promise<FreeFitmentCheckQuota> {
  const signedInUsed = await readSignedInFreeChecksUsed();
  const cookieUsed = await readFreeCheckCookie();
  const used = Math.max(signedInUsed ?? 0, cookieUsed);
  const remaining = Math.max(0, freeFitmentCheckLimit - used);

  return {
    limit: freeFitmentCheckLimit,
    used: Math.min(used, freeFitmentCheckLimit),
    remaining,
    canRunFreeCheck: remaining > 0
  };
}

export async function consumeFreeFitmentCheck(): Promise<FreeFitmentCheckQuota & { ok: boolean }> {
  const current = await getFreeFitmentCheckQuota();
  if (!current.canRunFreeCheck) {
    return { ok: false, ...current };
  }

  const nextUsed = current.used + 1;
  await writeFreeCheckCookie(nextUsed);
  await incrementSignedInFreeChecksUsed(nextUsed);

  const remaining = Math.max(0, freeFitmentCheckLimit - nextUsed);
  return {
    ok: true,
    limit: freeFitmentCheckLimit,
    used: nextUsed,
    remaining,
    canRunFreeCheck: remaining > 0
  };
}

async function readSignedInFreeChecksUsed() {
  if (!hasSupabaseServerEnv()) return null;

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) return null;

  const admin = createSupabaseAdminClient();
  const plan = await ensureFreeUserPlan(admin, currentUser.userId);
  const used = Number(plan?.fitment_checks_used ?? 0);
  return Number.isFinite(used) ? used : 0;
}

async function incrementSignedInFreeChecksUsed(nextUsed: number) {
  if (!hasSupabaseServerEnv()) return;

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) return;

  const admin = createSupabaseAdminClient();
  const plan = await ensureFreeUserPlan(admin, currentUser.userId);
  if (!plan) return;

  const { error } = await admin
    .from("user_plans")
    .update({ fitment_checks_used: nextUsed })
    .eq("user_id", currentUser.userId)
    .lt("fitment_checks_used", freeFitmentCheckLimit);

  if (error) console.error("Free fitment check increment failed", error);
}

async function readFreeCheckCookie() {
  const cookieStore = await cookies();
  const value = cookieStore.get(freeCheckCookieName)?.value;
  if (!value) return 0;

  const [count, signature] = value.split(".");
  if (!count || !signature || !safeEqual(signature, sign(count))) return 0;

  const used = Number(count);
  return Number.isFinite(used) && used > 0 ? used : 0;
}

async function writeFreeCheckCookie(used: number) {
  const cookieStore = await cookies();
  const count = String(Math.min(used, freeFitmentCheckLimit));

  cookieStore.set(freeCheckCookieName, `${count}.${sign(count)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: freeCheckCookieMaxAgeSeconds
  });
}

function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "dev-free-check-secret";
  return createHmac("sha256", secret).update(`free-fitment-checks:${value}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
