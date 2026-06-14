import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const destinationEmail = "driveline217@gmail.com";
// TODO: Use "Driveline <builds@tacomaverifier.net>" after tacomaverifier.net is verified in Resend.
const resendFromEmail = "Driveline <onboarding@resend.dev>";
const maxAttachmentBytes = 10 * 1024 * 1024;

const friendlyErrorMessage =
  "We’re having trouble submitting your build right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

type NullableString = string | null;
type NullableNumber = number | null;
type NullableBoolean = boolean | null;
type FitmentRisk = "low" | "medium" | "high";

type BuildSubmission = {
  contactEmail: NullableString;
  ownerName: NullableString;
  socialHandle: NullableString;
  year: NullableNumber;
  make: string;
  model: string;
  trim: NullableString;
  cab: NullableString;
  bed: NullableString;
  tireBrand: NullableString;
  tireModel: NullableString;
  tireSize: string;
  wheelBrand: NullableString;
  wheelModel: NullableString;
  wheelSize: string;
  wheelOffset: NullableNumber;
  liftHeight: NullableNumber;
  suspensionBrand: NullableString;
  suspensionModel: NullableString;
  suspensionType: NullableString;
  suspensionSetup: NullableString;
  rubbingSeverity: NullableString;
  trimmingRequired: NullableBoolean;
  bodyMountChop: NullableBoolean;
  fitmentRisk: FitmentRisk;
  fitmentNotes: NullableString;
  sourceUrl: NullableString;
  fullBuildList: NullableString;
};

type VerifiedBuildInsert = {
  user_id: string | null;
  year: number;
  make: string;
  model: string;
  trim: NullableString;
  cab: NullableString;
  bed: NullableString;
  tire_size: string;
  wheel_size: string;
  wheel_offset: NullableNumber;
  lift_height: NullableNumber;
  suspension_setup: NullableString;
  rubbing_severity: NullableString;
  trimming_required: NullableBoolean;
  body_mount_chop: NullableBoolean;
  fitment_risk: FitmentRisk;
  notes: NullableString;
  owner_name: NullableString;
  source_url: NullableString;
  published: false;
};

type EmailAttachment = {
  filename: string;
  content: Buffer;
};

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error("Missing NEXT_PUBLIC_SUPABASE_URL for submit-build route.");
      return NextResponse.json(
        {
          error: "Server is missing NEXT_PUBLIC_SUPABASE_URL",
          message: friendlyErrorMessage
        },
        { status: 500 }
      );
    }

    if (!serviceRoleKey) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY for submit-build route.");
      return NextResponse.json(
        {
          error: "Server is missing SUPABASE_SERVICE_ROLE_KEY",
          message: friendlyErrorMessage
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const submission = parseSubmission(formData);
    const validationError = validateSubmission(submission);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    console.log("Submit build request body:", {
      year: submission.year,
      make: submission.make,
      model: submission.model,
      tireSize: submission.tireSize,
      wheelSize: submission.wheelSize,
      hasAttachment: isFileLike(formData.get("attachment"))
    });

    const currentUser = await getOptionalCurrentUser();
    const insertPayload = buildVerifiedBuildInsert(submission, currentUser?.userId ?? null);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: insertedBuild, error: insertError } = await supabase
      .from("verified_builds")
      .insert(insertPayload)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Supabase verified_builds insert failed: ${insertError.message}`);
    }

    const attachmentFile = formData.get("attachment");
    const attachments = await buildAttachments(attachmentFile);
    const emailError = await sendSubmissionEmail(submission, insertPayload, insertedBuild?.id ?? null, attachments);

    if (emailError) {
      return NextResponse.json(
        {
          error: "Build submission email failed",
          message: friendlyErrorMessage,
          buildId: insertedBuild?.id ?? null,
          resendError: serializeError(emailError)
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, buildId: insertedBuild?.id ?? null });
  } catch (err) {
    console.error("Submit build API error:", err);

    return NextResponse.json(
      {
        error: "Build submission failed",
        message: friendlyErrorMessage,
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

async function getOptionalCurrentUser() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("Skipping submit-build auth lookup because Supabase public auth env vars are missing.", {
        hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
        hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      });
      return null;
    }

    const authSupabase = await createSupabaseServerClient();
    return getCurrentSupabaseUser(authSupabase);
  } catch (error) {
    console.error("Submit build auth lookup failed; continuing as anonymous submission:", error);
    return null;
  }
}

function parseSubmission(formData: FormData): BuildSubmission {
  return {
    contactEmail: emptyToNull(formData.get("contactEmail")),
    ownerName: emptyToNull(formData.get("ownerName")),
    socialHandle: emptyToNull(formData.get("socialHandle")),
    year: numberOrNull(formData.get("year")),
    make: emptyToNull(formData.get("make")) ?? "Toyota",
    model: emptyToNull(formData.get("model")) ?? "Tacoma",
    trim: emptyToNull(formData.get("trim")),
    cab: emptyToNull(formData.get("cab")),
    bed: emptyToNull(formData.get("bed")),
    tireBrand: emptyToNull(formData.get("tireBrand")),
    tireModel: emptyToNull(formData.get("tireModel")),
    tireSize: emptyToNull(formData.get("tireSize")) ?? "",
    wheelBrand: emptyToNull(formData.get("wheelBrand")),
    wheelModel: emptyToNull(formData.get("wheelModel")),
    wheelSize: emptyToNull(formData.get("wheelSize")) ?? "",
    wheelOffset: numberOrNull(formData.get("wheelOffset")),
    liftHeight: numberOrNull(formData.get("liftHeight")),
    suspensionBrand: emptyToNull(formData.get("suspensionBrand")),
    suspensionModel: emptyToNull(formData.get("suspensionModel")),
    suspensionType: emptyToNull(formData.get("suspensionType")),
    suspensionSetup: emptyToNull(formData.get("suspensionSetup")),
    rubbingSeverity: emptyToNull(formData.get("rubbingSeverity")),
    trimmingRequired: booleanOrNull(formData.get("trimmingRequired")),
    bodyMountChop: booleanOrNull(formData.get("bodyMountChop")),
    fitmentRisk: riskOrMedium(formData.get("fitmentRisk")),
    fitmentNotes: emptyToNull(formData.get("fitmentNotes")),
    sourceUrl: emptyToNull(formData.get("sourceUrl")),
    fullBuildList: emptyToNull(formData.get("fullBuildList"))
  };
}

function validateSubmission(submission: BuildSubmission) {
  if (submission.contactEmail && !isValidEmail(submission.contactEmail)) return "Please enter a valid contact email, or leave it blank.";
  if (!submission.year || !Number.isInteger(submission.year) || submission.year < 1995 || submission.year > 2035) return "Please enter a valid vehicle year.";
  if (!submission.make) return "Please enter the vehicle make.";
  if (!submission.model) return "Please enter the vehicle model.";
  if (!submission.ownerName) return "Please enter the owner or submitter name.";
  if (!submission.tireSize) return "Please enter the tire size.";
  if (!submission.wheelSize) return "Please enter the wheel size.";
  if (!submission.suspensionSetup && submission.liftHeight === null) return "Please enter either the lift height or suspension setup.";
  if (!submission.rubbingSeverity) return "Please select the rubbing severity.";
  if (submission.sourceUrl && !isValidUrl(submission.sourceUrl)) return "Please enter a valid source URL, or leave it blank.";
  return null;
}

function buildVerifiedBuildInsert(submission: BuildSubmission, userId: string | null): VerifiedBuildInsert {
  return {
    user_id: userId,
    year: submission.year ?? new Date().getFullYear(),
    make: submission.make || "Toyota",
    model: submission.model || "Tacoma",
    trim: submission.trim,
    cab: submission.cab,
    bed: submission.bed,
    tire_size: submission.tireSize,
    wheel_size: submission.wheelSize,
    wheel_offset: submission.wheelOffset,
    lift_height: submission.liftHeight,
    suspension_setup: submission.suspensionSetup,
    rubbing_severity: submission.rubbingSeverity,
    trimming_required: submission.trimmingRequired,
    body_mount_chop: submission.bodyMountChop,
    fitment_risk: submission.fitmentRisk,
    notes: buildNotes(submission),
    owner_name: submission.ownerName,
    source_url: submission.sourceUrl,
    published: false
  };
}

async function sendSubmissionEmail(
  submission: BuildSubmission,
  build: VerifiedBuildInsert,
  buildId: string | null,
  attachments: EmailAttachment[]
): Promise<unknown | null> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    const error = new Error("Missing RESEND_API_KEY for build submission notification; build was still saved.");
    console.error(error.message);
    return error;
  }

  const resend = new Resend(resendApiKey);
  const subject = `New Driveline Build Submission - ${build.year} ${build.make} ${build.model}`;
  const { error } = await resend.emails.send({
    from: resendFromEmail,
    to: destinationEmail,
    replyTo: submission.contactEmail ?? undefined,
    subject,
    text: buildEmailText(submission, build, buildId, attachments[0]?.filename ?? null),
    attachments
  });

  if (error) {
    console.error("Build submission notification email failed; build was still saved:", error);
    return error;
  }

  return null;
}

async function buildAttachments(value: FormDataEntryValue | null): Promise<EmailAttachment[]> {
  if (!isFileLike(value) || value.size === 0) return [];

  if (value.size > maxAttachmentBytes) {
    throw new Error("Attached file is larger than the 10 MB limit.");
  }

  return [
    {
      filename: value.name || "driveline-build-attachment",
      content: Buffer.from(await value.arrayBuffer())
    }
  ];
}

function isFileLike(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "size" in value &&
      typeof value.size === "number" &&
      "name" in value
  );
}

function buildEmailText(submission: BuildSubmission, build: VerifiedBuildInsert, buildId: string | null, attachmentName: string | null) {
  return `New Driveline Build Submission

Build ID
${buildId ?? "Not available"}

Contact:
Email: ${display(submission.contactEmail)}
Owner: ${display(build.owner_name)}
Social: ${display(submission.socialHandle)}

Vehicle:
Year: ${build.year}
Make: ${build.make}
Model: ${build.model}
Trim: ${display(build.trim)}
Cab: ${display(build.cab)}
Bed: ${display(build.bed)}

Wheels & Tires:
Wheel Brand: ${display(submission.wheelBrand)}
Wheel Model: ${display(submission.wheelModel)}
Wheel Size: ${build.wheel_size}
Wheel Offset: ${displayNumber(build.wheel_offset)}
Tire Brand: ${display(submission.tireBrand)}
Tire Model: ${display(submission.tireModel)}
Tire Size: ${build.tire_size}

Suspension & Clearance:
Lift Height: ${displayNumber(build.lift_height)}
Suspension Brand: ${display(submission.suspensionBrand)}
Suspension Model: ${display(submission.suspensionModel)}
Suspension Type: ${display(submission.suspensionType)}
Suspension Details: ${display(build.suspension_setup)}
Rubbing Severity: ${display(build.rubbing_severity)}
Trimming Required: ${displayBoolean(build.trimming_required)}
Body Mount Chop: ${displayBoolean(build.body_mount_chop)}
Fitment Risk: ${build.fitment_risk}

Extra Details:
Source URL: ${display(build.source_url)}
Build Notes: ${display(submission.fitmentNotes)}
Full Build List: ${display(submission.fullBuildList)}

Attachment:
${attachmentName ?? "No attachment provided"}`;
}

function buildNotes(submission: BuildSubmission) {
  return [
    submission.fitmentNotes ? `Fitment notes: ${submission.fitmentNotes}` : null,
    submission.fullBuildList ? `Full build list: ${submission.fullBuildList}` : null,
    submission.tireBrand ? `Tire brand: ${submission.tireBrand}` : null,
    submission.tireModel ? `Tire model: ${submission.tireModel}` : null,
    submission.wheelBrand ? `Wheel brand: ${submission.wheelBrand}` : null,
    submission.wheelModel ? `Wheel model: ${submission.wheelModel}` : null,
    submission.suspensionBrand ? `Suspension brand: ${submission.suspensionBrand}` : null,
    submission.suspensionModel ? `Suspension model: ${submission.suspensionModel}` : null,
    submission.suspensionType ? `Suspension type: ${submission.suspensionType}` : null,
    submission.socialHandle ? `Social handle: ${submission.socialHandle}` : null,
    submission.contactEmail ? `Contact email: ${submission.contactEmail}` : null
  ].filter((value): value is string => Boolean(value)).join("\n\n") || null;
}

function emptyToNull(value: unknown): NullableString {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: unknown): NullableNumber {
  const text = emptyToNull(value);
  if (text === null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function booleanOrNull(value: unknown): NullableBoolean {
  const text = emptyToNull(value)?.toLowerCase();
  if (!text || text === "unknown") return null;
  if (text === "true" || text === "yes") return true;
  if (text === "false" || text === "no") return false;
  return null;
}

function riskOrMedium(value: unknown): FitmentRisk {
  const text = emptyToNull(value)?.toLowerCase();
  if (text === "low" || text === "high") return text;
  return "medium";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "object" && error !== null) {
    return error;
  }

  return String(error);
}

function display(value: NullableString) {
  return value ?? "Not provided";
}

function displayNumber(value: NullableNumber) {
  return value === null ? "Unknown" : String(value);
}

function displayBoolean(value: NullableBoolean) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}
