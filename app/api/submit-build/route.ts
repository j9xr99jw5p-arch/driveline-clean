import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

const destinationEmail = "driveline217@gmail.com";
const maxAttachmentBytes = 10 * 1024 * 1024;

const friendlyErrorMessage =
  "We’re having trouble submitting your build right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

type NullableString = string | null;
type NullableNumber = number | null;
type NullableBoolean = boolean | null;

type BuildSubmission = {
  contactEmail: string;
  ownerName: NullableString;
  socialHandle: NullableString;
  year: number;
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
  wheelSize: NullableString;
  wheelOffset: NullableNumber;
  liftHeight: NullableNumber;
  suspensionBrand: NullableString;
  suspensionModel: NullableString;
  suspensionType: NullableString;
  suspensionSetup: NullableString;
  rubbingSeverity: NullableString;
  trimmingRequired: NullableBoolean;
  bodyMountChop: NullableBoolean;
  fitmentRisk: NullableString;
  fitmentNotes: NullableString;
  sourceUrl: NullableString;
  fullBuildList: NullableString;
};

type VerifiedBuildData = {
  user_id: null;
  year: number;
  make: string;
  model: string;
  trim: NullableString;
  cab: NullableString;
  bed: NullableString;
  tire_size: string;
  tire_brand: NullableString;
  tire_model: NullableString;
  wheel_size: NullableString;
  wheel_brand: NullableString;
  wheel_model: NullableString;
  wheel_offset: NullableNumber;
  lift_height: NullableNumber;
  suspension_setup: NullableString;
  suspension_brand: NullableString;
  suspension_model: NullableString;
  suspension_type: NullableString;
  rubbing_severity: NullableString;
  trimming_required: NullableBoolean;
  body_mount_chop: NullableBoolean;
  fitment_risk: "low" | "medium" | "high";
  notes: string;
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
    const formData = await request.formData();
    const submission = parseSubmission(formData);
    const validationError = validateSubmission(submission);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY for build submission email.");
      return NextResponse.json({ error: friendlyErrorMessage }, { status: 500 });
    }

    const attachmentFile = formData.get("attachment");
    const attachments = await buildAttachments(attachmentFile);
    const verifiedBuildData = mapToVerifiedBuildData(submission);
    const resend = new Resend(resendApiKey);
    const subject = `New Driveline Build Submission - ${submission.year} ${submission.make} ${submission.model}`;

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Driveline <onboarding@resend.dev>",
      to: destinationEmail,
      replyTo: submission.contactEmail,
      subject,
      text: buildEmailText(submission, verifiedBuildData, attachments[0]?.filename ?? null),
      attachments
    });

    if (error) {
      console.error("Build submission email failed:", error);
      return NextResponse.json({ error: friendlyErrorMessage }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Build submission route failed:", error);
    return NextResponse.json({ error: friendlyErrorMessage }, { status: 500 });
  }
}

function parseSubmission(formData: FormData): BuildSubmission {
  return {
    contactEmail: stringValue(formData, "contactEmail") ?? "",
    ownerName: stringValue(formData, "ownerName"),
    socialHandle: stringValue(formData, "socialHandle"),
    year: Number(stringValue(formData, "year")),
    make: stringValue(formData, "make") ?? "",
    model: stringValue(formData, "model") ?? "",
    trim: stringValue(formData, "trim"),
    cab: stringValue(formData, "cab"),
    bed: stringValue(formData, "bed"),
    tireBrand: stringValue(formData, "tireBrand"),
    tireModel: stringValue(formData, "tireModel"),
    tireSize: stringValue(formData, "tireSize") ?? "",
    wheelBrand: stringValue(formData, "wheelBrand"),
    wheelModel: stringValue(formData, "wheelModel"),
    wheelSize: stringValue(formData, "wheelSize"),
    wheelOffset: numberValue(formData, "wheelOffset"),
    liftHeight: numberValue(formData, "liftHeight"),
    suspensionBrand: stringValue(formData, "suspensionBrand"),
    suspensionModel: stringValue(formData, "suspensionModel"),
    suspensionType: stringValue(formData, "suspensionType"),
    suspensionSetup: stringValue(formData, "suspensionSetup"),
    rubbingSeverity: stringValue(formData, "rubbingSeverity"),
    trimmingRequired: booleanValue(formData, "trimmingRequired"),
    bodyMountChop: booleanValue(formData, "bodyMountChop"),
    fitmentRisk: stringValue(formData, "fitmentRisk"),
    fitmentNotes: stringValue(formData, "fitmentNotes"),
    sourceUrl: stringValue(formData, "sourceUrl"),
    fullBuildList: stringValue(formData, "fullBuildList")
  };
}

function validateSubmission(submission: BuildSubmission) {
  if (!isValidEmail(submission.contactEmail)) return "Please enter a valid contact email.";
  if (!Number.isInteger(submission.year) || submission.year < 1995 || submission.year > 2035) return "Please enter a valid vehicle year.";
  if (!submission.make) return "Please enter the vehicle make.";
  if (!submission.model) return "Please enter the vehicle model.";
  if (!submission.tireSize) return "Please enter the tire size.";
  if (submission.wheelOffset !== null && !Number.isFinite(submission.wheelOffset)) return "Please enter a valid wheel offset.";
  if (submission.liftHeight !== null && !Number.isFinite(submission.liftHeight)) return "Please enter a valid lift height.";
  if (submission.sourceUrl && !isValidUrl(submission.sourceUrl)) return "Please enter a valid source URL.";
  return null;
}

function mapToVerifiedBuildData(submission: BuildSubmission): VerifiedBuildData {
  return {
    user_id: null,
    year: submission.year,
    make: submission.make,
    model: submission.model,
    trim: submission.trim,
    cab: submission.cab,
    bed: submission.bed,
    tire_size: submission.tireSize,
    tire_brand: submission.tireBrand,
    tire_model: submission.tireModel,
    wheel_size: submission.wheelSize,
    wheel_brand: submission.wheelBrand,
    wheel_model: submission.wheelModel,
    wheel_offset: submission.wheelOffset,
    lift_height: submission.liftHeight,
    suspension_setup: submission.suspensionSetup,
    suspension_brand: submission.suspensionBrand,
    suspension_model: submission.suspensionModel,
    suspension_type: submission.suspensionType,
    rubbing_severity: submission.rubbingSeverity,
    trimming_required: submission.trimmingRequired,
    body_mount_chop: submission.bodyMountChop,
    fitment_risk: normalizeRisk(submission.fitmentRisk),
    notes: buildNotes(submission),
    owner_name: submission.ownerName,
    source_url: submission.sourceUrl,
    published: false
  };
}

async function buildAttachments(value: FormDataEntryValue | null): Promise<EmailAttachment[]> {
  if (!(value instanceof File) || value.size === 0) return [];

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

function buildEmailText(submission: BuildSubmission, build: VerifiedBuildData, attachmentName: string | null) {
  return `New Driveline Build Submission

Contact:
Email: ${submission.contactEmail}
Owner: ${display(submission.ownerName)}
Social: ${display(submission.socialHandle)}

Vehicle:
Year: ${build.year}
Make: ${build.make}
Model: ${build.model}
Trim: ${display(build.trim)}
Cab: ${display(build.cab)}
Bed: ${display(build.bed)}

Wheels & Tires:
Wheel Brand: ${display(build.wheel_brand)}
Wheel Model: ${display(build.wheel_model)}
Wheel Size: ${display(build.wheel_size)}
Wheel Offset: ${displayNumber(build.wheel_offset)}
Tire Brand: ${display(build.tire_brand)}
Tire Model: ${display(build.tire_model)}
Tire Size: ${build.tire_size}

Suspension & Clearance:
Lift Height: ${displayNumber(build.lift_height)}
Suspension Brand: ${display(build.suspension_brand)}
Suspension Model: ${display(build.suspension_model)}
Suspension Type: ${display(build.suspension_type)}
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
    submission.socialHandle ? `Social handle: ${submission.socialHandle}` : null,
    `Contact email: ${submission.contactEmail}`
  ].filter((value): value is string => Boolean(value)).join("\n\n");
}

function stringValue(formData: FormData, key: string): NullableString {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberValue(formData: FormData, key: string): NullableNumber {
  const value = stringValue(formData, key);
  if (value === null) return null;
  return Number(value);
}

function booleanValue(formData: FormData, key: string): NullableBoolean {
  const value = stringValue(formData, key)?.toLowerCase();
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function normalizeRisk(value: NullableString): "low" | "medium" | "high" {
  if (value === "low" || value === "high") return value;
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

function display(value: NullableString) {
  return value ?? "Not provided";
}

function displayNumber(value: NullableNumber) {
  return value === null ? "Not provided" : String(value);
}

function displayBoolean(value: NullableBoolean) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unknown";
}
