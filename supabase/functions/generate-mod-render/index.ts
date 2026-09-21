import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { calculateCredits, MAX_PHOTOS, normalizeModTags } from "../_shared/credits.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";
const imageModel = Deno.env.get("GEMINI_FITMENT_IMAGE_MODEL") || "gemini-3.1-flash-image";
const imageFallbackModel = Deno.env.get("GEMINI_FITMENT_IMAGE_FALLBACK_MODEL") || "gemini-3-pro-image";
const imageSize = Deno.env.get("GEMINI_FITMENT_IMAGE_SIZE") || "1K";
const extraImagePrompt = (Deno.env.get("GEMINI_FITMENT_IMAGE_PROMPT") || "").trim();
const photosBucket =
  Deno.env.get("SUPABASE_FITMENT_PHOTOS_BUCKET") ||
  Deno.env.get("SUPABASE_BUILD_PHOTOS_BUCKET") ||
  "verified-build-photos";

type RequestBody = {
  photoUrls?: unknown;
  photos?: unknown;
  photo_count?: unknown;
  photoCount?: unknown;
  mod_tags?: unknown;
  modTags?: unknown;
  mod_request_id?: unknown;
  prompt?: unknown;
  plannedChanges?: unknown;
  year?: unknown;
  make?: unknown;
  model?: unknown;
  trim?: unknown;
};

type InlineImage = {
  mimeType: string;
  data: string;
  aspectRatio?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
        inline_data?: { mime_type?: string; data?: string };
      }>;
    };
  }>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "not_configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const user = await getRequestUser(admin, request);
  if (!user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch (error) {
    console.error("Invalid generate-mod-render JSON", error);
    return jsonResponse({ error: "invalid_request" }, 400);
  }

  const photoUrls = readPhotoUrls(body);
  const modTags = normalizeModTags(body.mod_tags ?? body.modTags);
  const photoCount = Math.min(MAX_PHOTOS, readPhotoCount(body, photoUrls));

  if (!photoUrls.length || photoCount < 1) {
    return jsonResponse({ error: "photos_required" }, 400);
  }

  if (!geminiApiKey) {
    return jsonResponse({ error: "gemini_not_configured" }, 500);
  }

  const requiredCredits = calculateCredits({ photoCount, modTags });
  const modRequestId = await ensureModRequestId(admin, body.mod_request_id);

  const reserved = await reserveCredits(admin, user.id, requiredCredits, modRequestId);
  if (reserved.error) {
    console.error("reserve_credits failed", reserved.error);
    return jsonResponse({ error: "credit_reserve_failed" }, 500);
  }

  if (reserved.ok === false) {
    const available = await getAvailableCredits(admin, user.id);
    return jsonResponse(
      {
        error: "insufficient_credits",
        required: requiredCredits,
        available,
        message: `This render requires ${requiredCredits} credits. You have ${available} available.`
      },
      402
    );
  }

  try {
    const generatedImageUrls = await renderPhotos(geminiApiKey, admin, photoUrls, body, modTags);
    if (generatedImageUrls.length !== photoUrls.length) {
      throw new Error("Gemini did not return an image for every photo.");
    }

    return jsonResponse({
      success: true,
      required: requiredCredits,
      generatedImageUrl: generatedImageUrls[0] ?? null,
      generatedImageUrls,
      sourcePhotoUrls: photoUrls
    });
  } catch (error) {
    console.error("generate-mod-render Gemini failed after reserve", error);
    await refundCredits(admin, user.id, requiredCredits, modRequestId);
    return jsonResponse(
      {
        error: "render_failed",
        required: requiredCredits
      },
      502
    );
  }
});

async function getRequestUser(admin: SupabaseClient, request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function readPhotoUrls(body: RequestBody) {
  const values = [body.photoUrls, body.photos].find((value) => Array.isArray(value)) ?? [];

  return values
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url))
    .slice(0, MAX_PHOTOS);
}

function readPhotoCount(body: RequestBody, photoUrls: string[]) {
  const explicit = body.photo_count ?? body.photoCount;
  if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
  if (typeof explicit === "string" && explicit.trim()) {
    const parsed = Number(explicit);
    if (Number.isFinite(parsed)) return parsed;
  }
  return photoUrls.length;
}

async function ensureModRequestId(admin: SupabaseClient, value: unknown) {
  if (typeof value === "string" && isUuid(value)) return value;

  const { data, error } = await admin.from("mod_requests").insert({}).select("id").single();
  if (error) {
    console.error("Creating mod_request failed", error);
    return null;
  }

  return typeof data?.id === "string" ? data.id : null;
}

async function reserveCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  modRequestId: string | null
) {
  const { data, error } = await admin.rpc("reserve_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_mod_request_id: modRequestId
  });

  return { ok: data === true, error };
}

async function refundCredits(
  admin: SupabaseClient,
  userId: string,
  amount: number,
  modRequestId: string | null
) {
  const { error } = await admin.rpc("refund_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_mod_request_id: modRequestId
  });

  if (error) {
    console.error("refund_credits failed after Gemini error", error);
  }
}

async function getAvailableCredits(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("credit_balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Reading credit_balances failed", error);
    return 0;
  }

  return typeof data?.balance === "number" ? data.balance : 0;
}

async function renderPhotos(
  apiKey: string,
  admin: SupabaseClient,
  photoUrls: string[],
  body: RequestBody,
  modTags: string[]
) {
  const customerImages = await fetchInlineImages(photoUrls);
  if (customerImages.length !== photoUrls.length) {
    throw new Error("Could not load every source photo.");
  }

  const generated: string[] = [];

  for (const [index, image] of customerImages.entries()) {
    const bytes = await editOnePhoto(apiKey, image, body, modTags, index, customerImages.length);
    if (!bytes) throw new Error(`Gemini returned no image for photo ${index + 1}.`);
    generated.push(await storeGeneratedImage(admin, bytes));
  }

  return generated;
}

async function editOnePhoto(
  apiKey: string,
  customerImage: InlineImage,
  body: RequestBody,
  modTags: string[],
  index: number,
  count: number
) {
  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildImageEditPrompt(body, modTags, { index: index + 1, count }) },
          { inline_data: { mime_type: customerImage.mimeType, data: customerImage.data } }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        ...(customerImage.aspectRatio ? { aspectRatio: customerImage.aspectRatio } : {}),
        imageSize
      }
    }
  };

  for (const model of uniqueStrings([imageModel, imageFallbackModel])) {
    const bytes = await editWithModel(apiKey, model, payload);
    if (bytes) return bytes;
  }

  return null;
}

async function editWithModel(apiKey: string, model: string, body: unknown) {
  try {
    const payload = await generateGeminiContent(apiKey, model, body);
    const image = readGeminiImage(payload);
    if (!image) {
      console.error(`generate-mod-render returned no image from ${model}.`);
      return null;
    }
    return decodeBase64(image.data);
  } catch (error) {
    console.error(`generate-mod-render ${model} crashed:`, error);
    return null;
  }
}

async function generateGeminiContent(apiKey: string, model: string, body: unknown) {
  let lastError = "Gemini request failed.";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(`${geminiEndpoint}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    });

    if (response.ok) return (await response.json()) as GeminiResponse;

    lastError = await response.text();
    console.error(`Gemini ${model} attempt ${attempt} failed:`, lastError);

    if (response.status !== 429 && response.status < 500) break;
    await sleep(attempt * 1200);
  }

  throw new Error(lastError);
}

async function fetchInlineImages(urls: string[]) {
  const images: InlineImage[] = [];

  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!type.startsWith("image/")) continue;

    images.push({
      mimeType: type === "image/png" || type === "image/webp" ? type : "image/jpeg",
      data: encodeBase64(bytes),
      aspectRatio: geminiAspectRatio(readImageSize(bytes))
    });
  }

  return images;
}

async function storeGeneratedImage(admin: SupabaseClient, bytes: Uint8Array) {
  const path = `fitment-checks/generated/${Date.now()}-${crypto.randomUUID()}.png`;
  const { error } = await admin.storage.from(photosBucket).upload(path, bytes, {
    contentType: "image/png",
    upsert: false
  });

  if (error) {
    console.error("Storing generated mod render failed:", error);
    return `data:image/png;base64,${encodeBase64(bytes)}`;
  }

  return admin.storage.from(photosBucket).getPublicUrl(path).data.publicUrl;
}

function buildImageEditPrompt(
  body: RequestBody,
  modTags: string[],
  photo: { index: number; count: number }
) {
  const truck = [body.year, body.make, body.model, body.trim]
    .map((part) => (typeof part === "string" || typeof part === "number" ? String(part).trim() : ""))
    .filter(Boolean)
    .join(" ");
  const requestText =
    (typeof body.prompt === "string" && body.prompt.trim()) ||
    (typeof body.plannedChanges === "string" && body.plannedChanges.trim()) ||
    "";
  const tagList = modTags.length ? modTags.join(", ") : "none";
  const photoLine = photo.count > 1
    ? `This is photo ${photo.index} of ${photo.count} of the same vehicle. Apply every required change to this exact photo.`
    : "Apply every required change to this exact photo.";

  return [
    "You are performing a surgical edit on one existing photograph. Start from this photo and change only the required items.",
    photoLine,
    `Vehicle: ${truck || "the vehicle in this photo"}. Keep this exact vehicle.`,
    `Mod tags: ${tagList}.`,
    requestText ? `REQUIRED CHANGES:\n${requestText}` : "REQUIRED CHANGES: apply the listed mod tags only.",
    extraImagePrompt,
    "Change nothing else. No extra mods, no new parts, no restyling, no background cleanup, no crop, no zoom."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function readGeminiImage(payload: GeminiResponse) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) {
      const mimeType = "mimeType" in inline ? inline.mimeType : "mime_type" in inline ? inline.mime_type : undefined;
      return {
        mimeType: mimeType || "image/png",
        data: inline.data
      };
    }
  }

  return null;
}

function readImageSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const size = view.getUint16(offset + 2);
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7)
        };
      }
      offset += 2 + size;
    }
  }

  return null;
}

function geminiAspectRatio(size: { width: number; height: number } | null) {
  if (!size?.width || !size.height) return undefined;

  const ratio = size.width / size.height;
  const options = [
    { label: "16:9", value: 16 / 9 },
    { label: "4:3", value: 4 / 3 },
    { label: "1:1", value: 1 },
    { label: "3:4", value: 3 / 4 },
    { label: "9:16", value: 9 / 16 }
  ];

  return options.reduce((best, option) => (
    Math.abs(option.value - ratio) < Math.abs(best.value - ratio) ? option : best
  )).label;
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, list) => value && list.indexOf(value) === index);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json"
    }
  });
}
