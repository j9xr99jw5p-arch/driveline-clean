import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import {
  extractSpecsLocally,
  findMissingSpecs,
  mergeSpecs,
  type ExtractedSpecs,
  type ExtractionResult,
  type FitmentDescription
} from "@/lib/fitmentExtraction";
import { rewriteWrongTruckName } from "@/lib/fitmentVehicleCopy";

const descriptionSchema = z.object({
  year: z.string().trim().max(8).default(""),
  make: z.string().trim().max(60).default(""),
  model: z.string().trim().max(60).default(""),
  trim: z.string().trim().max(60).default(""),
  plannedChanges: z.string().trim().max(2000).default(""),
  currentSetup: z.string().trim().max(2000).default(""),
  usage: z.string().trim().max(2000).default(""),
  buildGoals: z.string().trim().max(2000).default(""),
  extraNotes: z.string().trim().max(2000).default("")
});

// The AI is only allowed to report what the owner actually wrote, so every
// field is nullable and gets dropped when it comes back empty.
const aiSpecsSchema = z.object({
  currentTireSize: z.string().trim().max(32).nullish(),
  tireSize: z.string().trim().max(32).nullish(),
  wheelDiameter: z.coerce.number().min(14).max(24).nullish(),
  wheelWidth: z.coerce.number().min(6).max(14).nullish(),
  wheelOffset: z.coerce.number().min(-80).max(80).nullish(),
  liftHeight: z.coerce.number().min(0).max(10).nullish(),
  useCase: z.enum(["daily", "mixed", "off-road"]).nullish(),
  rearLoad: z.enum(["normal", "sometimes-heavy", "constant-heavy"]).nullish(),
  cab: z.string().trim().max(32).nullish(),
  bed: z.string().trim().max(32).nullish(),
  interpretation: z.string().trim().max(600).nullish()
});

const extractWindowMs = 60 * 60 * 1000;
const extractLimit = 40;
const extractBuckets = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = descriptionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid description." }, { status: 400 });

  const description = parsed.data as FitmentDescription;

  if (!description.plannedChanges && !description.currentSetup) {
    return NextResponse.json({ error: "Tell us what you want to do to the truck first." }, { status: 400 });
  }

  if (isRateLimited(await getRequestIp())) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const localSpecs = extractSpecsLocally(description);
  const aiOutcome = await extractWithAi(description, localSpecs);
  // Regex wins on conflict: it reads exact formats like 285/70R17 literally,
  // while the model can drift on which tire was the current one.
  const specs = mergeSpecs(aiOutcome.specs, localSpecs);

  const result: ExtractionResult = {
    specs,
    missing: findMissingSpecs(specs),
    interpretation: aiOutcome.interpretation,
    usedAi: aiOutcome.usedAi
  };

  return NextResponse.json(result);
}

async function extractWithAi(description: FitmentDescription, localSpecs: ExtractedSpecs) {
  const empty = { specs: {} as ExtractedSpecs, interpretation: null as string | null, usedAi: false };
  if (!process.env.OPENAI_API_KEY) return empty;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_FITMENT_EXTRACT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildExtractionPrompt(description, localSpecs) }
        ]
      })
    });

    if (!response.ok) {
      console.error("Fitment extraction request failed:", await response.text());
      return empty;
    }

    const data = await response.json();
    const text = readResponseText(data);
    if (!text) return empty;

    const json = parseJsonObject(text);
    if (!json) return empty;

    const validated = aiSpecsSchema.safeParse(json);
    if (!validated.success) {
      console.error("Fitment extraction returned an unusable shape:", validated.error.message);
      return empty;
    }

    const { interpretation, ...rawSpecs } = validated.data;
    const specs: ExtractedSpecs = {};

    for (const [key, value] of Object.entries(rawSpecs)) {
      if (value === null || value === undefined || value === "") continue;
      Object.assign(specs, { [key]: value });
    }

    return {
      specs,
      interpretation: interpretation ? rewriteWrongTruckName(interpretation, description) : null,
      usedAi: true
    };
  } catch (error) {
    console.error("Fitment extraction crashed:", error);
    return empty;
  }
}

const systemPrompt = [
  "You read a truck owner's plain-English description of a build and pull out the wheel and tire specifications it mentions.",
  "Return ONLY a JSON object. No prose, no code fences.",
  "Never guess or invent a specification. If the owner did not state or clearly imply a value, use null for it.",
  "tireSize is the setup the owner WANTS. currentTireSize is what is on the truck NOW. Do not swap them.",
  "Normalize tire sizes to 285/70R17 or 35x12.50R17 format. wheelOffset is millimeters and is negative for most aggressive truck offsets.",
  "liftHeight is inches of suspension lift as a number; a leveling kit alone is about 2.",
  "useCase must be daily, mixed, or off-road. rearLoad must be normal, sometimes-heavy, or constant-heavy.",
  "cab should be 'Access Cab' or 'Double Cab' only if stated. bed should be '5 ft' or '6 ft' only if stated.",
  "interpretation is one or two sentences telling the owner what you understood, in second person. Use the Vehicle line as the truck name. Never say Tacoma unless that vehicle is a Toyota Tacoma. Mention anything important they left out.",
  "",
  "Respond with exactly these keys:",
  '{"currentTireSize":null,"tireSize":null,"wheelDiameter":null,"wheelWidth":null,"wheelOffset":null,"liftHeight":null,"useCase":null,"rearLoad":null,"cab":null,"bed":null,"interpretation":""}'
].join("\n");

function buildExtractionPrompt(description: FitmentDescription, localSpecs: ExtractedSpecs) {
  const vehicle = [description.year, description.make, description.model, description.trim]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");

  return [
    `Vehicle: ${vehicle || "not specified"}. Refer to this truck only by that name.`,
    "",
    "What they want to do to the truck:",
    description.plannedChanges || "(not provided)",
    "",
    "What they have already done:",
    description.currentSetup || "(not provided)",
    "",
    "How they use the truck:",
    description.usage || "(not provided)",
    "",
    "Build goals:",
    description.buildGoals || "(not provided)",
    "",
    "Anything else:",
    description.extraNotes || "(not provided)",
    "",
    "A pattern matcher already found these values with high confidence; reuse them and focus on what is still missing:",
    JSON.stringify(localSpecs)
  ].join("\n");
}

function readResponseText(data: unknown): string | null {
  const payload = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const joined = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text)
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .trim();

  return joined || null;
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

async function getRequestIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headerStore.get("x-real-ip") || "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const current = extractBuckets.get(key);

  if (!current || current.resetAt <= now) {
    extractBuckets.set(key, { count: 1, resetAt: now + extractWindowMs });
    return false;
  }

  if (current.count >= extractLimit) return true;

  current.count += 1;
  return false;
}
