import { NextResponse } from "next/server";
import { z } from "zod";
import { assessFitment, normalizeFitmentInput } from "@/lib/fitment";
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
  inputSchema,
  z.object({
    input: inputSchema,
    aiExplanation: aiReportSchema.nullish()
  })
]);

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid fitment input" }, { status: 400 });

  const parsedInput = "input" in parsed.data ? parsed.data.input : parsed.data;
  const aiExplanation = "input" in parsed.data ? parsed.data.aiExplanation ?? null : null;

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);
  if (!currentUser) return NextResponse.json({ error: "Sign in before creating fitment assessments." }, { status: 401 });

  const { userId } = currentUser;

  const { data: plan } = await supabase
    .from("user_plans")
    .select("plan, status, fitment_check_limit, fitment_checks_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (plan && plan.fitment_checks_used >= plan.fitment_check_limit) {
    return NextResponse.json({ error: "Fitment check limit reached." }, { status: 402 });
  }

  const input = normalizeFitmentInput(parsedInput);
  const deterministicReport = assessFitment(input);
  const report = {
    ...deterministicReport,
    aiExplanation
  };
  let garageSyncError: string | null = null;

  const { error } = await supabase.from("fitment_assessments").insert({
    user_id: userId,
    input,
    report,
    overall_verdict: report.verdict,
    rubbing_risk: report.rubbingRisk,
    trimming_likely: report.trimmingLikely,
    body_mount_chop_likely: report.bodyMountChopLikely
  });
  if (error) return NextResponse.json({ error: "Could not save assessment." }, { status: 500 });

  try {
    await saveGarageVehicleConfiguration(supabase, userId, input);
  } catch {
    garageSyncError = "Assessment saved, but the garage vehicle could not be synced. Please try again shortly.";
  }

  const admin = createSupabaseAdminClient();
  await admin.from("user_plans").upsert({
    user_id: userId,
    plan: plan?.plan ?? "free",
    status: plan?.status ?? "active",
    fitment_check_limit: plan?.fitment_check_limit ?? 3,
    fitment_checks_used: (plan?.fitment_checks_used ?? 0) + 1
  }, { onConflict: "user_id" });

  return NextResponse.json({ report, garageSyncError });
}
