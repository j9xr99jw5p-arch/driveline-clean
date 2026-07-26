import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewEmail = "driveline217@gmail.com";
const fallbackResendFromEmail = "Driveline <auth@tacomaverifier.net>";

type FitmentRisk = "low" | "medium" | "high";

export async function POST(request: Request) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid build submission form data." }, { status: 400 });
    }

    const getString = (name: string) => {
      const value = formData.get(name);
      return typeof value === "string" ? value.trim() : "";
    };

    const toNumberOrNull = (value: string) => {
      if (!value) return null;
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : null;
    };

    const yesNoToBooleanOrNull = (value: string) => {
      const normalized = value.toLowerCase();
      if (normalized === "yes") return true;
      if (normalized === "no") return false;
      return null;
    };

    const normalizeRisk = (value: string): FitmentRisk => {
      const normalized = value.toLowerCase();
      if (normalized === "low") return "low";
      if (normalized === "high") return "high";
      return "medium";
    };

    const year = Number(getString("year"));
    const fitmentNotes = getString("fitmentNotes");
    const fullBuildList = getString("fullBuildList");
    const contactEmail = getString("contactEmail");
    const socialHandle = getString("socialHandle");
    const tireBrand = getString("tireBrand");
    const tireModel = getString("tireModel");
    const wheelBrand = getString("wheelBrand");
    const wheelModel = getString("wheelModel");
    const suspensionType = getString("suspensionType");
    const suspensionBrand = getString("suspensionBrand");
    const suspensionModel = getString("suspensionModel");
    const lightingUpgrades = getString("lightingUpgrades");
    const favoriteModifications = getString("favoriteModifications");
    const make = getString("make");
    const model = getString("model");
    const liftHeight = getString("liftHeight");
    const wheelOffset = getString("wheelOffset");
    const sourceUrl = getString("sourceUrl");
    const hasAttachment = getString("hasAttachment") === "yes";
    const trimmingRequired = getString("trimmingRequired");
    const bodyMountChop = getString("bodyMountChop");

    const notes = [
      fitmentNotes && `Fitment notes: ${fitmentNotes}`,
      fullBuildList && `Full build list: ${fullBuildList}`,
      lightingUpgrades && `Lighting upgrades: ${lightingUpgrades}`,
      favoriteModifications && `Favorite modifications / recommendations: ${favoriteModifications}`,
      tireBrand && `Tire brand: ${tireBrand}`,
      tireModel && `Tire model: ${tireModel}`,
      wheelBrand && `Wheel brand: ${wheelBrand}`,
      wheelModel && `Wheel model: ${wheelModel}`,
      wheelOffset && toNumberOrNull(wheelOffset) === null && `Wheel offset: ${wheelOffset}`,
      liftHeight && toNumberOrNull(liftHeight) === null && `Lift height: ${liftHeight}`,
      suspensionType && `Suspension type: ${suspensionType}`,
      suspensionBrand && `Suspension brand: ${suspensionBrand}`,
      suspensionModel && `Suspension model: ${suspensionModel}`,
      trimmingRequired && yesNoToBooleanOrNull(trimmingRequired) === null && `Trimming required: ${trimmingRequired}`,
      bodyMountChop && yesNoToBooleanOrNull(bodyMountChop) === null && `Body mount chop: ${bodyMountChop}`,
      hasAttachment && "Attachment provided with submission."
    ]
      .filter(Boolean)
      .join("\n\n");

    const insertData = {
      year,
      make,
      model,
      trim: getString("trim") || null,
      cab: getString("cab") || null,
      bed: getString("bed") || null,
      tire_size: getString("tireSize"),
      tire_brand: tireBrand || null,
      tire_model: tireModel || null,
      wheel_size: getString("wheelSize"),
      wheel_brand: wheelBrand || null,
      wheel_model: wheelModel || null,
      wheel_offset: toNumberOrNull(wheelOffset),
      lift_height: toNumberOrNull(liftHeight),
      suspension_setup: getString("suspensionSetup") || null,
      suspension_brand: suspensionBrand || null,
      suspension_model: suspensionModel || null,
      suspension_type: suspensionType || null,
      rubbing_severity: getString("rubbingSeverity") || null,
      trimming_required: yesNoToBooleanOrNull(trimmingRequired),
      body_mount_chop: yesNoToBooleanOrNull(bodyMountChop),
      fitment_risk: normalizeRisk(getString("fitmentRisk")),
      lighting_upgrades: lightingUpgrades || null,
      favorite_modifications: favoriteModifications || null,
      source_url: sourceUrl || null,
      notes: notes || null,
      owner_name: socialHandle || "Anonymous",
      published: false
    };

    if (!Number.isInteger(insertData.year) || insertData.year < 1995 || insertData.year > 2035) {
      return NextResponse.json({ error: "Please enter a valid vehicle year." }, { status: 400 });
    }

    if (!insertData.make || !insertData.model || !insertData.tire_size || !insertData.wheel_size) {
      return NextResponse.json({ error: "Missing build fields." }, { status: 400 });
    }

    if (!hasAttachment) {
      return NextResponse.json({ error: "Please attach at least one photo or file." }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase submit-build environment variables.", {
        hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      });

      return NextResponse.json(
        {
          error: "Build submission failed.",
          details: "Build submissions are temporarily unavailable."
        },
        { status: 500 }
      );
    }

    const supabase = createSubmitSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const insertResult = await supabase
      .from("verified_builds")
      .insert(insertData)
      .select("id")
      .single();
    let data = insertResult.data;
    let error = insertResult.error;

    if (error?.code === "42703" || error?.code === "PGRST204") {
      const fallbackInsertData: Partial<typeof insertData> = { ...insertData };
      delete fallbackInsertData.lighting_upgrades;
      delete fallbackInsertData.favorite_modifications;
      delete fallbackInsertData.tire_brand;
      delete fallbackInsertData.tire_model;
      delete fallbackInsertData.wheel_brand;
      delete fallbackInsertData.wheel_model;
      delete fallbackInsertData.suspension_brand;
      delete fallbackInsertData.suspension_model;
      delete fallbackInsertData.suspension_type;

      const fallbackResult = await supabase
        .from("verified_builds")
        .insert(fallbackInsertData)
        .select("id")
        .single();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      console.error("Supabase submit-build insert failed:", error);
      return NextResponse.json(
        {
          error: "Build submission failed.",
          details: "We could not save your build right now.",
          code: error.code
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.error("Supabase submit-build insert returned no data.");
      return NextResponse.json(
        {
          error: "Build submission failed.",
          details: "Build was not created."
        },
        { status: 500 }
      );
    }

    const emailWarning = await sendReviewNotification(data.id, insertData, contactEmail);

    if (emailWarning) {
      return NextResponse.json({ ok: true, id: data.id, emailWarning });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    console.error("Submit build route crashed:", error);

    return NextResponse.json(
      {
        error: "Build submission failed.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

function createSubmitSupabaseClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function sendReviewNotification(
  buildId: string,
  build: {
    year: number;
    make: string;
    model: string;
    trim: string | null;
    cab: string | null;
    bed: string | null;
    tire_size: string;
    tire_brand: string | null;
    tire_model: string | null;
    wheel_size: string;
    wheel_brand: string | null;
    wheel_model: string | null;
    wheel_offset: number | null;
    lift_height: number | null;
    suspension_setup: string | null;
    suspension_brand: string | null;
    suspension_model: string | null;
    suspension_type: string | null;
    rubbing_severity: string | null;
    trimming_required: boolean | null;
    body_mount_chop: boolean | null;
    fitment_risk: FitmentRisk;
    source_url: string | null;
    notes: string | null;
    owner_name: string;
    lighting_upgrades: string | null;
    favorite_modifications: string | null;
  },
  replyTo: string
) {
  if (!process.env.RESEND_API_KEY) {
    const warning = "Missing RESEND_API_KEY; build was saved but review email was not sent.";
    console.error(warning);
    return warning;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || fallbackResendFromEmail,
    to: reviewEmail,
    replyTo: replyTo || undefined,
    subject: `New build submitted for review - ${build.year} ${build.make} ${build.model}`,
    text: buildReviewEmailText(buildId, build)
  });

  if (error) {
    console.error("Build review notification email failed:", error);
    return error.message;
  }

  return null;
}

function buildReviewEmailText(
  buildId: string,
  build: {
    year: number;
    make: string;
    model: string;
    trim: string | null;
    cab: string | null;
    bed: string | null;
    tire_size: string;
    tire_brand: string | null;
    tire_model: string | null;
    wheel_size: string;
    wheel_brand: string | null;
    wheel_model: string | null;
    wheel_offset: number | null;
    lift_height: number | null;
    suspension_setup: string | null;
    suspension_brand: string | null;
    suspension_model: string | null;
    suspension_type: string | null;
    rubbing_severity: string | null;
    trimming_required: boolean | null;
    body_mount_chop: boolean | null;
    fitment_risk: FitmentRisk;
    source_url: string | null;
    notes: string | null;
    owner_name: string;
    lighting_upgrades: string | null;
    favorite_modifications: string | null;
  }
) {
  return `A new Driveline build was submitted for review.

Build ID: ${buildId}
Owner: ${build.owner_name}

Vehicle:
${build.year} ${build.make} ${build.model}
Trim: ${build.trim ?? "Not provided"}
Cab: ${build.cab ?? "Not provided"}
Bed: ${build.bed ?? "Not provided"}

Fitment:
Tire size: ${build.tire_size}
Tire brand: ${build.tire_brand ?? "Unknown"}
Tire model: ${build.tire_model ?? "Unknown"}
Wheel size: ${build.wheel_size}
Wheel brand: ${build.wheel_brand ?? "Unknown"}
Wheel model: ${build.wheel_model ?? "Unknown"}
Wheel offset: ${build.wheel_offset ?? "Unknown"}
Lift height: ${build.lift_height ?? "Unknown"}
Suspension setup: ${build.suspension_setup ?? "Not provided"}
Suspension type: ${build.suspension_type ?? "Not provided"}
Suspension brand: ${build.suspension_brand ?? "Not provided"}
Suspension model: ${build.suspension_model ?? "Not provided"}

Clearance:
Rubbing severity: ${build.rubbing_severity ?? "Not provided"}
Trimming required: ${displayBoolean(build.trimming_required)}
Body mount chop: ${displayBoolean(build.body_mount_chop)}
Fitment risk: ${build.fitment_risk}

Lighting upgrades:
${build.lighting_upgrades ?? "Not provided"}

Favorite modifications / recommendations:
${build.favorite_modifications ?? "Not provided"}

Source URL: ${build.source_url ?? "Not provided"}

Notes:
${build.notes ?? "No notes provided"}`;
}

function displayBoolean(value: boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}
