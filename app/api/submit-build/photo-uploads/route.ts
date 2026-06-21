import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buildPhotosBucket = process.env.SUPABASE_BUILD_PHOTOS_BUCKET || "verified-build-photos";

type UploadFileInput = {
  name: string;
  type?: string;
  size?: number;
};

type CompletePhotoInput = {
  buildId: string;
  url: string;
  altText: string;
  sortOrder: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.action === "complete") {
      return completePhotoUploads(body.photos);
    }

    return preparePhotoUploads(body?.buildId, body?.files);
  } catch (error) {
    console.error("Submit build photo upload route crashed:", error);

    return NextResponse.json(
      {
        error: "Photo upload failed.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

async function preparePhotoUploads(buildId: unknown, files: unknown) {
  if (typeof buildId !== "string" || !buildId) {
    return NextResponse.json({ error: "Missing build ID." }, { status: 400 });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ uploads: [] });
  }

  const supabase = createSubmitSupabaseClient();
  await ensureBuildPhotosBucket(supabase);

  const uploads = [];

  for (const [index, file] of files.entries()) {
    if (!isUploadFileInput(file)) continue;

    const extension = getFileExtension(file.name);
    const safeName = slugifyFilename(file.name || `upload-${index + 1}`);
    const path = `${buildId}/new-submission-${Date.now()}-${index + 1}-${safeName}${extension}`;
    const altText = `new submission - ${file.name || `file ${index + 1}`}`;

    const { data, error } = await supabase.storage
      .from(buildPhotosBucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error("Creating signed upload URL failed:", error);
      return NextResponse.json(
        {
          error: "Photo upload failed.",
          details: error.message
        },
        { status: 500 }
      );
    }

    const publicUrl = supabase.storage.from(buildPhotosBucket).getPublicUrl(path).data.publicUrl;

    uploads.push({
      path,
      token: data.token,
      publicUrl,
      altText,
      sortOrder: index
    });
  }

  return NextResponse.json({ uploads });
}

async function completePhotoUploads(photos: unknown) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const rows = photos.filter(isCompletePhotoInput).map((photo) => ({
    build_id: photo.buildId,
    url: photo.url,
    alt_text: photo.altText.includes("new submission")
      ? photo.altText
      : `new submission - ${photo.altText}`,
    sort_order: photo.sortOrder
  }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const supabase = createSubmitSupabaseClient();
  const { error } = await supabase.from("verified_build_photos").insert(rows);

  if (error) {
    console.error("Inserting verified_build_photos rows failed:", error);
    return NextResponse.json(
      {
        error: "Photo upload failed.",
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}

function createSubmitSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Photo uploads are temporarily unavailable.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function ensureBuildPhotosBucket(supabase: ReturnType<typeof createSubmitSupabaseClient>) {
  const { error } = await supabase.storage.getBucket(buildPhotosBucket);

  if (!error) return;

  const { error: createError } = await supabase.storage.createBucket(buildPhotosBucket, {
    public: true
  });

  if (createError && createError.message !== "Bucket already exists") {
    throw createError;
  }
}

function isUploadFileInput(value: unknown): value is UploadFileInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function isCompletePhotoInput(value: unknown): value is CompletePhotoInput {
  return (
    typeof value === "object" &&
    value !== null &&
    "buildId" in value &&
    "url" in value &&
    "altText" in value &&
    "sortOrder" in value &&
    typeof value.buildId === "string" &&
    typeof value.url === "string" &&
    typeof value.altText === "string" &&
    typeof value.sortOrder === "number"
  );
}

function getFileExtension(filename: string) {
  const match = filename.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function slugifyFilename(filename: string) {
  const nameWithoutExtension = filename.replace(/\.[a-z0-9]+$/i, "");
  return nameWithoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "upload";
}
