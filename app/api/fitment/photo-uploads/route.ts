import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const fitmentPhotosBucket =
  process.env.SUPABASE_FITMENT_PHOTOS_BUCKET ||
  process.env.SUPABASE_BUILD_PHOTOS_BUCKET ||
  "verified-build-photos";

type UploadFileInput = {
  name: string;
  type?: string;
  size?: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return preparePhotoUploads(body?.checkId, body?.files);
  } catch (error) {
    console.error("Fitment photo upload route crashed:", error);

    return NextResponse.json(
      {
        error: "Photo upload failed.",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

async function preparePhotoUploads(checkId: unknown, files: unknown) {
  if (typeof checkId !== "string" || !checkId) {
    return NextResponse.json({ error: "Missing check ID." }, { status: 400 });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ uploads: [] });
  }

  if (files.length > 3) {
    return NextResponse.json({ error: "Upload 1 to 3 photos." }, { status: 400 });
  }

  const supabase = createFitmentPhotoClient();
  await ensureFitmentPhotosBucket(supabase);

  const uploads = [];

  for (const [index, file] of files.entries()) {
    if (!isUploadFileInput(file)) continue;

    const extension = getFileExtension(file.name) || guessExtension(file.type);
    const safeName = slugifyFilename(file.name || `photo-${index + 1}`);
    const path = `fitment-checks/${checkId}/${Date.now()}-${index + 1}-${safeName}${extension}`;

    const { data, error } = await supabase.storage.from(fitmentPhotosBucket).createSignedUploadUrl(path);

    if (error) {
      console.error("Creating fitment photo upload URL failed:", error);
      return NextResponse.json(
        {
          error: "Photo upload failed.",
          details: error.message
        },
        { status: 500 }
      );
    }

    const publicUrl = supabase.storage.from(fitmentPhotosBucket).getPublicUrl(path).data.publicUrl;

    uploads.push({
      path,
      token: data.token,
      publicUrl,
      bucket: fitmentPhotosBucket,
      sortOrder: index
    });
  }

  return NextResponse.json({ uploads, bucket: fitmentPhotosBucket });
}

function createFitmentPhotoClient() {
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

async function ensureFitmentPhotosBucket(supabase: ReturnType<typeof createFitmentPhotoClient>) {
  const { error } = await supabase.storage.getBucket(fitmentPhotosBucket);

  if (!error) return;

  const { error: createError } = await supabase.storage.createBucket(fitmentPhotosBucket, {
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

function getFileExtension(filename: string) {
  const match = filename.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : "";
}

function guessExtension(type: string | undefined) {
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  return ".jpg";
}

function slugifyFilename(filename: string) {
  const nameWithoutExtension = filename.replace(/\.[a-z0-9]+$/i, "");
  return (
    nameWithoutExtension
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "upload"
  );
}
