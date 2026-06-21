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
    const formData = await request.formData();

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

    const notes = [
      fitmentNotes && `Fitment notes: ${fitmentNotes}`,
      fullBuildList && `Full build list: ${fullBuildList}`,
      lightingUpgrades && `Lighting upgrades: ${lightingUpgrades}`,
      favoriteModifications && `Favorite modifications / recommendations: ${favoriteModifications}`,
      tireBrand && `Tire brand: ${tireBrand}`,
      tireModel && `Tire model: ${tireModel}`,
      wheelBrand && `Wheel brand: ${wheelBrand}`,
      wheelModel && `Wheel model: ${wheelModel}`,
      suspensionType && `Suspension type: ${suspensionType}`,
      suspensionBrand && `Suspension brand: ${suspensionBrand}`,
      suspensionModel && `Suspension model: ${suspensionModel}`
    ]
      .filter(Boolean)
      .join("\n\n");

    const insertData = {
      year,
      make: getString("make") || "Toyota",
      model: getString("model") || "Tacoma",
      trim: getString("trim") || null,
      cab: getString("cab") || null,
      bed: getString("bed") || null,
      tire_size: getString("tireSize"),
      wheel_size: getString("wheelSize"),
      wheel_offset: toNumberOrNull(getString("wheelOffset")),
      lift_height: toNumberOrNull(getString("liftHeight")),
      suspension_setup: getString("suspensionSetup") || null,
      rubbing_severity: getString("rubbingSeverity") || null,
      trimming_required: yesNoToBooleanOrNull(getString("trimmingRequired")),
      body_mount_chop: yesNoToBooleanOrNull(getString("bodyMountChop")),
      fitment_risk: normalizeRisk(getString("fitmentRisk")),
      lighting_upgrades: lightingUpgrades || null,
      favorite_modifications: favoriteModifications || null,
      source_url: getString("sourceUrl") || null,
      notes: notes || null,
      owner_name: socialHandle || "Anonymous",
      published: false
    };

    if (!Number.isInteger(insertData.year) || insertData.year < 1995 || insertData.year > 2035) {
      return NextResponse.json({ error: "Please enter a valid vehicle year." }, { status: 400 });
    }

    if (!insertData.tire_size || !insertData.wheel_size) {
      return NextResponse.json({ error: "Missing required build fields." }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase submit-build environment variables.", {
        hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      });

      return NextResponse.json(
        {
          error: "Build submission failed.",
          details: "Server is missing Supabase configuration."
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
      const { lighting_upgrades, favorite_modifications, ...fallbackInsertData } = insertData;
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
          details: error.message,
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
    wheel_size: string;
    wheel_offset: number | null;
    lift_height: number | null;
    suspension_setup: string | null;
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
    wheel_size: string;
    wheel_offset: number | null;
    lift_height: number | null;
    suspension_setup: string | null;
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
Wheel size: ${build.wheel_size}
Wheel offset: ${build.wheel_offset ?? "Unknown"}
Lift height: ${build.lift_height ?? "Unknown"}
Suspension setup: ${build.suspension_setup ?? "Not provided"}

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
