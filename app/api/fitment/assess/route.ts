import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { assessFitment, buildPremiumFitmentInsights, buildPremiumWarnings, normalizeFitmentInput } from "@/lib/fitment";
import { consumeFreeFitmentCheck, getFreeFitmentCheckQuota } from "@/lib/freeFitmentChecks";
import { getFitmentEntitlementForCurrentUser } from "@/lib/fitmentEntitlements";
import { saveGarageVehicleConfiguration } from "@/lib/garage";
import {
  createModRequest,
  refundSpendableCredits,
  reserveSpendableCredits
} from "@/lib/spendableCredits";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findMatchingVerifiedBuilds } from "@/lib/verifiedBuildMatch";
import { calculateCredits, normalizeModTags } from "@/src/lib/credits";

const inputSchema = z.object({
  year: z.coerce.number().int().min(1995).max(2035),
  make: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  trim: z.string().min(1),
  cab: z.string().min(1),
  bed: z.string().min(1),
  currentTireSize: z.string().optional(),
  tireSize: z.string().min(5),
  wheelDiameter: z.coerce.number().min(14).max(24),
  wheelWidth: z.coerce.number().min(6).max(14),
  wheelOffset: z.coerce.number().min(-80).max(80),
  liftHeight: z.coerce.number().min(0).max(10),
  useCase: z.string().min(1),
  rearLoad: z.string().min(1),
  buildGoals: z.string().optional()
});

const aiReportSchema = z.object({
  headline: z.string(),
  overviewAdvice: z.string(),
  dailyDrivingAdvice: z.string(),
  offRoadAdvice: z.string(),
  beforeYouCommit: z.string(),
  disclaimer: z.string()
});

const creditUsageSchema = {
  photoCount: z.coerce.number().int().min(0).max(3).optional(),
  modTags: z.array(z.string().trim().max(40)).max(12).optional()
};

const schema = z.union([
  inputSchema.extend({
    mode: z.enum(["free", "premium"]).optional(),
    requestId: z.string().trim().min(8).max(120).optional(),
    ...creditUsageSchema
  }),
  z.object({
    input: inputSchema,
    mode: z.enum(["free", "premium"]).default("free"),
    requestId: z.string().trim().min(8).max(120).optional(),
    aiExplanation: aiReportSchema.nullish(),
    ...creditUsageSchema
  })
]);

const freeCheckWindowMs = 24 * 60 * 60 * 1000;
const freeCheckLimit = 8;
const freeCheckBuckets = new Map<string, { count: number; resetAt: number }>();
const outOfChecksMessage = "You need more credits. $4.99 adds 50, $14.99 adds 150, or $25/month adds 250 with Priority.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid fitment input" }, { status: 400 });

  const parsedInput = "input" in parsed.data ? parsed.data.input : parsed.data;
  const aiExplanation = "input" in parsed.data ? parsed.data.aiExplanation ?? null : null;

  const input = normalizeFitmentInput(parsedInput);
  const requiredCredits = calculateCredits({
    photoCount: parsed.data.photoCount ?? 0,
    modTags: normalizeModTags(parsed.data.modTags)
  });
  const deterministicReport = assessFitment(input);
  const entitlement = await getFitmentEntitlementForCurrentUser();
  const freeQuota = await getFreeFitmentCheckQuota();
  const billing = freeQuota.unlimited
    ? "free"
    : entitlement.isAuthenticated
      ? "credits"
      : freeQuota.canRunFreeCheck
        ? "free"
        : null;

  if (!billing) {
    return NextResponse.json({ error: outOfChecksMessage, freeChecks: freeQuota }, { status: 429 });
  }

  if (billing === "free" && !freeQuota.unlimited && isFreeCheckLimited(await getRequestIp())) {
    return NextResponse.json({ error: "Free fitment check limit reached. Please try again later." }, { status: 429 });
  }

  const matches = await findMatchingVerifiedBuilds(input);
  const premiumInsights = buildPremiumFitmentInsights(input, deterministicReport);
  premiumInsights.verifiedBuildMatchStatus = matches.status;

  const report = {
    ...deterministicReport,
    accessTier: billing === "credits" ? "premium" as const : "free" as const,
    aiExplanation,
    premiumWarnings: buildPremiumWarnings(input, deterministicReport),
    premiumInsights,
    matchedBuilds: matches.builds
  };

  if (billing === "free") {
    const consumed = freeQuota.unlimited ? { ok: true as const, ...freeQuota } : await consumeFreeFitmentCheck();
    if (!consumed.ok) {
      return NextResponse.json({ error: outOfChecksMessage, freeChecks: consumed }, { status: 429 });
    }

    let garageSyncError: string | null = null;
    if (entitlement.userId) {
      try {
        garageSyncError = await persistSignedInCheck({
          userId: entitlement.userId,
          input,
          report
        });
      } catch (error) {
        console.error("Signed-in free check save failed", error);
        garageSyncError = "We’re having trouble saving your garage details right now. Your fitment report is still available.";
      }
    }

    return NextResponse.json({ report, garageSyncError, entitlement, freeChecks: consumed });
  }

  if (!entitlement.userId) {
    return NextResponse.json({ error: "Sign in before using credits." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const modRequestId = await createModRequest(admin);

  let reserved;
  try {
    reserved = await reserveSpendableCredits({
      supabase: admin,
      userId: entitlement.userId,
      amount: requiredCredits,
      modRequestId
    });
  } catch (error) {
    console.error("Spendable credit reserve failed", error);
    return NextResponse.json({ error: "Could not use your credits. Please try again." }, { status: 500 });
  }

  if (!reserved.ok) {
    return NextResponse.json({
      error: outOfChecksMessage,
      required: requiredCredits,
      available: reserved.available,
      freeChecks: freeQuota
    }, { status: 402 });
  }

  try {
    const garageSyncError = await persistSignedInCheck({
      userId: entitlement.userId,
      input,
      report
    });
    const updatedEntitlement = await getFitmentEntitlementForCurrentUser();
    return NextResponse.json({
      report,
      garageSyncError,
      entitlement: updatedEntitlement,
      freeChecks: freeQuota,
      creditsCharged: requiredCredits
    });
  } catch (error) {
    console.error("Credit fitment check failed", error);
    await refundSpendableCredits({
      supabase: admin,
      userId: entitlement.userId,
      amount: requiredCredits,
      modRequestId
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not use your credits. Please try again." }, { status: 500 });
  }
}

async function persistSignedInCheck({
  userId,
  input,
  report
}: {
  userId: string;
  input: ReturnType<typeof normalizeFitmentInput>;
  report: ReturnType<typeof assessFitment> & Record<string, unknown>;
}) {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser || currentUser.userId !== userId) {
    throw new Error("Sign in before using a paid fitment check.");
  }

  const { error } = await supabase.from("fitment_assessments").insert({
    user_id: userId,
    input,
    report,
    overall_verdict: report.verdict,
    rubbing_risk: report.rubbingRisk,
    trimming_likely: report.trimmingLikely,
    body_mount_chop_likely: report.bodyMountChopLikely
  });
  if (error) throw new Error("Could not save assessment.");

  try {
    await saveGarageVehicleConfiguration(supabase, userId, input);
    return null;
  } catch {
    return "We’re having trouble saving your garage details right now. Your fitment report is still available.";
  }
}

async function getRequestIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headerStore.get("x-real-ip") || "unknown";
}

function isFreeCheckLimited(key: string) {
  const now = Date.now();
  const current = freeCheckBuckets.get(key);

  if (!current || current.resetAt <= now) {
    freeCheckBuckets.set(key, { count: 1, resetAt: now + freeCheckWindowMs });
    return false;
  }

  if (current.count >= freeCheckLimit) return true;

  current.count += 1;
  return false;
}
