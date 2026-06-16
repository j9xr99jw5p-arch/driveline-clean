import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const notes = [
      fitmentNotes && `Fitment notes: ${fitmentNotes}`,
      fullBuildList && `Full build list: ${fullBuildList}`,
      contactEmail && `Contact email: ${contactEmail}`,
      socialHandle && `Social handle: ${socialHandle}`,
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
      source_url: getString("sourceUrl") || null,
      notes: notes || null,
      owner_name: getString("ownerName"),
      published: false
    };

    if (!Number.isInteger(insertData.year) || insertData.year < 1995 || insertData.year > 2035) {
      return NextResponse.json({ error: "Please enter a valid vehicle year." }, { status: 400 });
    }

    if (!insertData.owner_name || !insertData.tire_size || !insertData.wheel_size) {
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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data, error } = await supabase
      .from("verified_builds")
      .insert(insertData)
      .select("id")
      .single();

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
