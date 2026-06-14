import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional()
).transform((value) => value ?? null);

const optionalUrl = optionalText.refine((value) => {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid URL");

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? null : value),
  z.coerce.number().nullable().optional()
).transform((value) => value ?? null);

const yesNoUnknown = z.enum(["true", "false", "unknown", "Unknown", "yes", "no", "Yes", "No", ""]).transform((value) => {
  const normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "no") return false;
  return null;
});

const schema = z.object({
  year: z.coerce.number().int().min(1995).max(2035),
  make: optionalText.default("Toyota"),
  model: optionalText.default("Tacoma"),
  trim: optionalText,
  cab: optionalText,
  bed: optionalText,
  tire_size: z.string().trim().min(5),
  tire_brand: optionalText,
  tire_model: optionalText,
  wheel_size: z.string().trim().min(2),
  wheel_brand: optionalText,
  wheel_model: optionalText,
  wheel_offset: optionalNumber,
  lift_height: optionalNumber,
  suspension_setup: optionalText,
  suspension_brand: optionalText,
  suspension_model: optionalText,
  suspension_type: optionalText,
  rubbing_severity: z.string().trim().min(1),
  trimming_required: yesNoUnknown,
  body_mount_chop: yesNoUnknown,
  fitment_risk: z.enum(["low", "medium", "high", "unknown", "Unknown", "Low", "Medium", "High", ""]).optional().transform((value) => {
    const normalized = value?.toLowerCase();
    if (normalized === "low" || normalized === "high") return normalized;
    return "medium";
  }),
  notes: optionalText,
  owner_name: z.string().trim().min(1),
  owner_email: optionalText,
  source_url: optionalUrl,
  photo_url: optionalUrl
}).refine((data) => data.suspension_setup || data.lift_height !== null, {
  message: "Lift height or suspension setup is required.",
  path: ["suspension_setup"]
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid build submission." }, { status: 400 });

  const authSupabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(authSupabase);
  const supabase = createSupabaseAdminClient();
  const { owner_email, photo_url, notes, make, model, fitment_risk, ...build } = parsed.data;
  const ownerNotes = [
    notes,
    owner_email ? `Owner email: ${owner_email}` : null,
    photo_url ? `Photo URL: ${photo_url}` : null
  ].filter((value): value is string => Boolean(value)).join("\n\n");

  const { error } = await supabase.from("verified_builds").insert({
    ...build,
    user_id: currentUser?.userId ?? null,
    make: make ?? "Toyota",
    model: model ?? "Tacoma",
    notes: ownerNotes || null,
    fitment_risk: fitment_risk ?? "medium",
    published: false
  });
  if (error) {
    console.error("Verified build insert failed:", error);
    return NextResponse.json({ error: "Could not submit build." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
