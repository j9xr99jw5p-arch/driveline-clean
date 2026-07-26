import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { assessFitment, buildPremiumFitmentInsights, buildPremiumWarnings, normalizeFitmentInput } from "@/lib/fitment";
import { consumePremiumFitmentCredit, getFitmentEntitlementForUser } from "@/lib/fitmentEntitlements";
import { saveGarageVehicleConfiguration } from "@/lib/garage";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  year: z.coerce.number().int().min(1995).max(2035),
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

const schema = z.union([
  inputSchema.extend({
    mode: z.enum(["free", "premium"]).optional(),
    requestId: z.string().trim().min(8).max(120).optional()
  }),
  z.object({
    input: inputSchema,
    mode: z.enum(["free", "premium"]).default("premium"),
    requestId: z.string().trim().min(8).max(120).optional(),
    aiExplanation: aiReportSchema.nullish()
  })
]);

const freeCheckWindowMs = 60 * 60 * 1000;
const freeCheckLimit = 30;
const freeCheckBuckets = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid fitment input" }, { status: 400 });

  const parsedInput = "input" in parsed.data ? parsed.data.input : parsed.data;
  const mode = "input" in parsed.data ? parsed.data.mode : parsed.data.mode ?? "free";
  const requestId = "input" in parsed.data ? parsed.data.requestId ?? null : parsed.data.requestId ?? null;
  const aiExplanation = "input" in parsed.data ? parsed.data.aiExplanation ?? null : null;

  const input = normalizeFitmentInput(parsedInput);
  const deterministicReport = assessFitment(input);
  const report = {
    ...deterministicReport,
    accessTier: mode,
    aiExplanation: mode === "premium" ? aiExplanation : null
  };

  if (mode === "free") {
    if (isFreeCheckLimited(await getRequestIp())) {
      return NextResponse.json({ error: "Free fitment check limit reached. Please try again later." }, { status: 429 });
    }

    return NextResponse.json({
      report: buildFreeReport({
        ...deterministicReport,
        accessTier: "free",
        aiExplanation: null
      }),
      entitlement: null
    });
  }

  if (!aiExplanation) {
    return NextResponse.json(
      { error: "The premium AI report could not be generated. No premium check was used." },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) return NextResponse.json({ error: "Sign in before using a premium fitment check." }, { status: 401 });

  const { userId } = currentUser;
  const entitlement = await getFitmentEntitlementForUser(userId);
  if (!entitlement.canRunPremiumCheck) {
    return NextResponse.json({ error: "You do not have any premium fitment checks remaining." }, { status: 402 });
  }

  let garageSyncError: string | null = null;
  const admin = createSupabaseAdminClient();
  const premiumInsights = buildPremiumFitmentInsights(input, deterministicReport);
  premiumInsights.verifiedBuildMatchStatus = await getVerifiedBuildMatchStatus(admin, input);
  const premiumReport = {
    ...report,
    premiumWarnings: buildPremiumWarnings(input, deterministicReport),
    premiumInsights
  };

  const { data: assessment, error } = await supabase.from("fitment_assessments").insert({
    user_id: userId,
    input,
    report: premiumReport,
    overall_verdict: premiumReport.verdict,
    rubbing_risk: premiumReport.rubbingRisk,
    trimming_likely: premiumReport.trimmingLikely,
    body_mount_chop_likely: premiumReport.bodyMountChopLikely
  }).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Could not save assessment." }, { status: 500 });

  try {
    await saveGarageVehicleConfiguration(supabase, userId, input);
  } catch {
    garageSyncError = "Assessment saved, but the garage vehicle could not be synced. Please try again shortly.";
  }

  let updatedEntitlement = entitlement;

  if (entitlement.premiumChecksRemaining > 0) {
    try {
      const consumed = await consumePremiumFitmentCredit({
        supabase: admin,
        userId,
        fitmentCheckId: typeof assessment?.id === "string" ? assessment.id : null,
        requestId,
        metadata: {
          tire_size: input.tireSize,
          wheel_diameter: input.wheelDiameter,
          wheel_width: input.wheelWidth,
          wheel_offset: input.wheelOffset,
          lift_height: input.liftHeight
        }
      });

      updatedEntitlement = {
        ...entitlement,
        premiumChecksRemaining: consumed?.premium_checks_remaining ?? Math.max(0, entitlement.premiumChecksRemaining - 1),
        canRunPremiumCheck: (consumed?.premium_checks_remaining ?? 0) > 0,
        canViewPremiumBuilds: entitlement.canViewPremiumBuilds
      };
    } catch (consumeError) {
      console.error("Premium fitment credit consume failed", consumeError);
      return NextResponse.json({ error: "Could not use a premium check. Please try again." }, { status: 500 });
    }
  }

  return NextResponse.json({ report: premiumReport, garageSyncError, entitlement: updatedEntitlement });
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

async function getVerifiedBuildMatchStatus(supabase: ReturnType<typeof createSupabaseAdminClient>, input: ReturnType<typeof normalizeFitmentInput>) {
  try {
    const minOffset = input.wheelOffset - 12;
    const maxOffset = input.wheelOffset + 12;
    const minWidth = input.wheelWidth - 0.5;
    const maxWidth = input.wheelWidth + 0.5;
    const minLift = Math.max(0, input.liftHeight - 0.75);
    const maxLift = input.liftHeight + 0.75;
    const { count, error } = await supabase
      .from("verified_builds")
      .select("id", { count: "exact", head: true })
      .eq("published", true)
      .eq("year", input.year)
      .eq("tire_size", input.tireSize)
      .gte("wheel_offset", minOffset)
      .lte("wheel_offset", maxOffset)
      .gte("wheel_width", minWidth)
      .lte("wheel_width", maxWidth)
      .gte("lift_height", minLift)
      .lte("lift_height", maxLift);

    if (error) {
      console.error("Verified build match lookup failed", error);
      return "Verified-build match status could not be checked right now.";
    }

    if (!count) return "No closely matching verified builds yet - check back as the database grows.";
    return `${count} similar verified ${count === 1 ? "build" : "builds"} found.`;
  } catch (error) {
    console.error("Verified build match lookup crashed", error);
    return "Verified-build match status could not be checked right now.";
  }
}

function buildFreeReport(report: ReturnType<typeof assessFitment> & { accessTier: "free" | "premium"; aiExplanation: null }) {
  const { premiumInsights: _premiumInsights, premiumWarnings: _premiumWarnings, ...freeReport } = report;
  void _premiumInsights;
  void _premiumWarnings;
  return {
    ...freeReport,
    accessTier: "free" as const,
    warnings: report.warnings.slice(0, 2),
    recommendations: report.recommendations.slice(0, 1),
    aiExplanation: {
      headline: report.verdict,
      overviewAdvice: "This free check gives a conservative overview of rubbing and clearance risk.",
      dailyDrivingAdvice: "For daily driving, verify full-lock clearance and listen for liner, mud-flap, or bumper contact before committing.",
      offRoadAdvice: "Trail use can create rubbing that does not appear on pavement because steering angle and suspension compression stack together.",
      beforeYouCommit: "Premium checks add alternative setup comparison, trim-location detail, scenario breakdown, and verified-build match status.",
      disclaimer: "Estimate only. Final clearance should be verified on the actual vehicle."
    }
  };
}
