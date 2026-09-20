import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildImageEditPrompt,
  buildVisionPrompt,
  emptyFitmentVisualizeResult,
  imageFallbackModel,
  imageModel,
  imageSize,
  parseVisionResult,
  visionModel,
  type FitmentVisionResult,
  type FitmentVisualizeResult
} from "@/lib/fitmentVisualize";
import type { FitmentInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const fitmentPhotosBucket =
  process.env.SUPABASE_FITMENT_PHOTOS_BUCKET ||
  process.env.SUPABASE_BUILD_PHOTOS_BUCKET ||
  "verified-build-photos";

const maxPhotos = 3;
const geminiEndpoint = "https://generativelanguage.googleapis.com/v1beta/models";

type InlineImage = {
  mimeType: string;
  data: string;
  name: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const photoUrls = sanitizePhotoUrls(body?.photoUrls);
    const input = body?.input as FitmentInput | undefined;

    if (!photoUrls.length || !input?.year) {
      return NextResponse.json({
        ...emptyFitmentVisualizeResult,
        sourcePhotoUrls: photoUrls
      } satisfies FitmentVisualizeResult);
    }

    const [vision, generatedImageUrls] = await Promise.all([
      inspectPhotos(photoUrls),
      editTruckPhotos(photoUrls, input)
    ]);

    return NextResponse.json({
      generatedImageUrl: generatedImageUrls[0] ?? null,
      generatedImageUrls,
      sourcePhotoUrls: photoUrls,
      alreadyModified: vision?.alreadyModified ?? false,
      vision
    } satisfies FitmentVisualizeResult);
  } catch (error) {
    console.error("Fitment visualize route crashed:", error);
    return NextResponse.json(
      {
        ...emptyFitmentVisualizeResult,
        error: "Visualization failed."
      } satisfies FitmentVisualizeResult,
      { status: 200 }
    );
  }
}

function sanitizePhotoUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//i.test(url))
    .slice(0, maxPhotos);
}

function geminiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

async function inspectPhotos(photoUrls: string[]): Promise<FitmentVisionResult | null> {
  const apiKey = geminiKey();
  if (!apiKey) return null;

  try {
    const images = await fetchInlineImages(photoUrls, "truck");
    if (!images.length) return null;

    const payload = await generateGeminiContent(apiKey, visionModel, {
      systemInstruction: { parts: [{ text: buildVisionPrompt() }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Is this truck already modified? Return JSON only." },
            ...images.map((image) => ({ inline_data: { mime_type: image.mimeType, data: image.data } }))
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const text = readGeminiText(payload);
    if (!text) return null;
    return parseVisionResult(parseJsonObject(text));
  } catch (error) {
    console.error("Fitment vision crashed:", error);
    return null;
  }
}

async function editTruckPhotos(photoUrls: string[], input: FitmentInput) {
  const apiKey = geminiKey();
  if (!apiKey) {
    console.error("Fitment image edit skipped: GEMINI_API_KEY is not set.");
    return [];
  }

  const customerImages = await fetchInlineImages(photoUrls, "truck");
  if (!customerImages.length) return [];

  const generated = await Promise.all(
    customerImages.map((image) => editOneTruckPhoto(apiKey, image, input))
  );

  return generated.filter((url): url is string => Boolean(url));
}

async function editOneTruckPhoto(apiKey: string, customerImage: InlineImage, input: FitmentInput) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildImageEditPrompt(input) },
          { inline_data: { mime_type: customerImage.mimeType, data: customerImage.data } }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "4:3",
        imageSize
      }
    }
  };

  for (const model of [imageModel, imageFallbackModel].filter((value, index, list) => list.indexOf(value) === index)) {
    const bytes = await editWithModel(apiKey, model, body);
    if (bytes) return storeGeneratedImage(bytes);
  }

  return null;
}

async function editWithModel(apiKey: string, model: string, body: unknown) {
  try {
    const payload = await generateGeminiContent(apiKey, model, body);
    const image = readGeminiImage(payload);
    if (!image) {
      console.error(`Fitment image edit returned no image from ${model}.`);
      return null;
    }

    return Buffer.from(image.data, "base64");
  } catch (error) {
    console.error(`Fitment image edit with ${model} crashed:`, error);
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

    if (response.ok) return response.json();

    lastError = await response.text();
    console.error(`Gemini ${model} attempt ${attempt} failed:`, lastError);

    if (response.status !== 429 && response.status < 500) break;
    await sleep(attempt * 1200);
  }

  throw new Error(lastError);
}

async function fetchInlineImages(urls: string[], prefix: string) {
  const images: InlineImage[] = [];

  for (const [index, url] of urls.entries()) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      const type = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
      if (!type.startsWith("image/")) continue;
      images.push({
        mimeType: type === "image/png" || type === "image/webp" ? type : "image/jpeg",
        data: buffer.toString("base64"),
        name: `${prefix}-${index + 1}`
      });
    } catch (error) {
      console.error("Fetching visualize source image failed:", error);
    }
  }

  return images;
}

async function storeGeneratedImage(bytes: Buffer) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const path = `fitment-checks/generated/${Date.now()}-${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from(fitmentPhotosBucket).upload(path, bytes, {
    contentType: "image/png",
    upsert: false
  });

  if (error) {
    console.error("Storing generated fitment image failed:", error);
    return null;
  }

  return supabase.storage.from(fitmentPhotosBucket).getPublicUrl(path).data.publicUrl;
}

function readGeminiText(payload: GeminiResponse) {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((part) => part.text)
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .trim() || null;
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

function parseJsonObject(text: string): unknown {
  const withoutFence = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
