import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function emptyToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

function numberOrNull(value: unknown) {
  if (value === "" || value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function booleanOrNull(value: unknown) {
  if (value === "" || value === undefined || value === null) return null;
  if (value === true || value === "true" || value === "yes" || value === "Yes") return true;
  if (value === false || value === "false" || value === "no" || value === "No") return false;
  return null;
}

const optionalText = z.preprocess(emptyToNull, z.string().trim().nullable().optional()).transform((value) => value ?? null);
const optionalNumber = z.preprocess(numberOrNull, z.number().nullable()).transform((value) => value ?? null);
const optionalBoolean = z.preprocess(booleanOrNull, z.boolean().nullable()).transform((value) => value ?? null);
const optionalUrl = optionalText.refine((value) => {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid URL");

const schema = z.object({
  year: z.coerce.number().int().min(1995).max(2035),
  make: optionalText,
  model: optionalText,
  trim: optionalText,
  cab: optionalText,
  bed: optionalText,
  tire_size: z.string().trim().min(1),
  wheel_size: optionalText,
  wheel_offset: optionalNumber,
  lift_height: optionalNumber,
  suspension_setup: optionalText,
  rubbing_severity: optionalText,
  trimming_required: optionalBoolean,
  body_mount_chop: optionalBoolean,
  fitment_risk: z.preprocess(emptyToNull, z.enum(["low", "medium", "high", "Low", "Medium", "High"]).nullable().optional()).transform((value) => {
    const normalized = value?.toLowerCase();
    return normalized === "low" || normalized === "high" ? normalized : "medium";
  }),
  notes: optionalText,
  owner_name: optionalText,
  owner_email: optionalText,
  source_url: optionalUrl,
  photo_url: optionalUrl,
  tire_brand: optionalText,
  tire_model: optionalText,
  wheel_brand: optionalText,
  wheel_model: optionalText,
  suspension_brand: optionalText,
  suspension_model: optionalText,
  suspension_type: optionalText
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid build submission.", details: parsed.error.flatten() }, { status: 400 });

    const authSupabase = await createSupabaseServerClient();
    const currentUser = await getCurrentSupabaseUser(authSupabase);
    const supabase = createSupabaseAdminClient();
    const data = parsed.data;
    const notes = [
      data.notes,
      data.owner_email ? `Owner email: ${data.owner_email}` : null,
      data.photo_url ? `Photo URL: ${data.photo_url}` : null,
      data.tire_brand ? `Tire brand: ${data.tire_brand}` : null,
      data.tire_model ? `Tire model: ${data.tire_model}` : null,
      data.wheel_brand ? `Wheel brand: ${data.wheel_brand}` : null,
      data.wheel_model ? `Wheel model: ${data.wheel_model}` : null,
      data.suspension_brand ? `Suspension brand: ${data.suspension_brand}` : null,
      data.suspension_model ? `Suspension model: ${data.suspension_model}` : null,
      data.suspension_type ? `Suspension type: ${data.suspension_type}` : null
    ].filter((value): value is string => Boolean(value)).join("\n\n") || null;

    const insertPayload = {
      user_id: currentUser?.userId ?? null,
      year: data.year,
      make: data.make ?? "Toyota",
      model: data.model ?? "Tacoma",
      trim: data.trim,
      cab: data.cab,
      bed: data.bed,
      tire_size: data.tire_size,
      wheel_size: data.wheel_size,
      wheel_offset: data.wheel_offset,
      lift_height: data.lift_height,
      suspension_setup: data.suspension_setup,
      rubbing_severity: data.rubbing_severity,
      trimming_required: data.trimming_required,
      body_mount_chop: data.body_mount_chop,
      fitment_risk: data.fitment_risk,
      notes,
      owner_name: data.owner_name,
      source_url: data.source_url,
      published: false
    };

    const { error } = await supabase.from("verified_builds").insert(insertPayload);
    if (error) throw new Error(`Supabase verified_builds insert failed: ${error.message}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Submit build API error:", err);

    return NextResponse.json(
      {
        error: "Build submission failed",
        details:
          err instanceof Error
            ? err.message
            : typeof err === "object"
              ? JSON.stringify(err)
              : String(err)
      },
      { status: 500 }
    );
  }
}
