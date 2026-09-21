const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const friendlyUserMessage =
  "We’re having trouble generating your fitment report right now. We’re working to fix it as quickly as possible. Please try again in a moment.";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.3-mini";

type FitmentAiReport = {
  headline: string;
  overviewAdvice: string;
  dailyDrivingAdvice: string;
  offRoadAdvice: string;
  beforeYouCommit: string;
  disclaimer: string;
};

type RequestBody = {
  debug?: boolean;
  input?: Record<string, unknown>;
  deterministicReport?: Record<string, unknown>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed", userMessage: friendlyUserMessage }, 405);
  }

  try {
    let body: RequestBody;
    try {
      body = await request.json();
    } catch (error) {
      console.error("Invalid request JSON for fitment report generation", error);
      return jsonResponse({ success: false, error: "invalid_request", userMessage: friendlyUserMessage }, 400);
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (body.debug === true) {
      return jsonResponse({
        success: true,
        hasOpenAiKey: Boolean(openAiApiKey),
        model: OPENAI_MODEL
      });
    }

    if (!openAiApiKey) {
      console.error("Missing OPENAI_API_KEY for fitment report generation");
      return jsonResponse({ success: false, error: "report_unavailable", userMessage: friendlyUserMessage }, 500);
    }

    if (!body.input || !body.deterministicReport) {
      return jsonResponse({ success: false, error: "invalid_request", userMessage: friendlyUserMessage }, 400);
    }

    const normalizedInput = normalizeFitmentInput(body.input);
    const deterministicReport = body.deterministicReport;
    const sourceOfTruth = {
      overallVerdict: deterministicReport.verdict ?? deterministicReport.overallVerdict,
      rubbingRisk: deterministicReport.rubbingRisk,
      trimmingLikely: deterministicReport.trimmingLikely,
      bodyMountChopLikely: deterministicReport.bodyMountChopLikely,
      suspensionStress: deterministicReport.suspensionStress,
      dailyDrivability: deterministicReport.dailyDrivability,
      offRoadPracticality: deterministicReport.offRoadPracticality,
      warnings: deterministicReport.warnings,
      recommendations: deterministicReport.recommendations,
      premiumInsights: deterministicReport.premiumInsights
    };

    let openAiResponse: Response;
    try {
      openAiResponse = await callResponsesApi(openAiApiKey, OPENAI_MODEL, normalizedInput, sourceOfTruth, deterministicReport);
    } catch (error) {
      console.error("OpenAI request failure", error);
      return jsonResponse({ success: false, error: "report_unavailable", userMessage: friendlyUserMessage }, 502);
    }

    if (!openAiResponse.ok) {
      const errorText = await openAiResponse.text().catch(() => "Unable to read error body");
      console.error("OpenAI request failure", {
        status: openAiResponse.status,
        model: OPENAI_MODEL,
        body: errorText
      });

      return jsonResponse(
        {
          success: false,
          error: "openai_request_failed",
          openAiStatus: openAiResponse.status,
          model: OPENAI_MODEL,
          debugMessage: errorText.slice(0, 1000),
          userMessage:
            openAiResponse.status === 401 || openAiResponse.status === 403
              ? "OpenAI model or API key access is not configured correctly."
              : "The AI report could not be generated."
        },
        502
      );
    }

    let responseData: unknown;
    try {
      responseData = await openAiResponse.json();
    } catch (error) {
      console.error("Invalid OpenAI response JSON", error);
      return jsonResponse({ success: false, error: "report_unavailable", userMessage: friendlyUserMessage }, 502);
    }

    const outputContent = extractOutputText(responseData);
    if (!outputContent) {
      console.error("Missing output content", responseData);
      return jsonResponse({ success: false, error: "report_unavailable", userMessage: friendlyUserMessage }, 502);
    }

    let aiReport: FitmentAiReport;
    try {
      aiReport = JSON.parse(outputContent) as FitmentAiReport;
    } catch (error) {
      console.error("Invalid OpenAI response JSON", error, outputContent);
      return jsonResponse({ success: false, error: "report_unavailable", userMessage: friendlyUserMessage }, 502);
    }

    return jsonResponse({ success: true, aiReport: rewriteAiReport(aiReport, normalizedInput) });
  } catch (error) {
    console.error("Unexpected server error", error);
    return jsonResponse({ success: false, error: "report_unavailable", userMessage: friendlyUserMessage }, 500);
  }
});

function callResponsesApi(
  openAiApiKey: string,
  model: string,
  input: Record<string, unknown>,
  deterministicSourceOfTruth: Record<string, unknown>,
  deterministicReport: Record<string, unknown>
) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${openAiApiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a Driveline wheel, tire, and lift fitment advisor. Write short, practical advice a truck owner can scan in under a minute. The truck is identified in the input year, make, and model. Always call it by that name. If it is not a Toyota Tacoma, do not say Tacoma or Toyota Tacoma anywhere. The deterministic report is the source of truth — do not contradict it. Each JSON string must be 1-2 sentences and under 220 characters. headline must be 8 words or fewer. Do not write long paragraphs or repeat the same warning. Return only valid JSON."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Write a short premium fitment brief. Keep every field to 1-2 tight sentences. Do not repeat the deterministic summary. Refer to the truck only as the year, make, and model in input.",
            input,
            deterministicSourceOfTruth,
            deterministicReport
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "fitment_advice",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              headline: { type: "string" },
              overviewAdvice: { type: "string" },
              dailyDrivingAdvice: { type: "string" },
              offRoadAdvice: { type: "string" },
              beforeYouCommit: { type: "string" },
              disclaimer: { type: "string" }
            },
            required: [
              "headline",
              "overviewAdvice",
              "dailyDrivingAdvice",
              "offRoadAdvice",
              "beforeYouCommit",
              "disclaimer"
            ]
          }
        }
      },
      tools: [],
      store: false,
      max_output_tokens: 900
    })
  });
}

function extractOutputText(responseData: unknown) {
  const data = responseData as {
    output_text?: unknown;
    output?: Array<{
      content?: Array<{
        text?: unknown;
      }>;
    }>;
  };

  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const nestedText = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find((text) => typeof text === "string" && text.trim());

  return typeof nestedText === "string" ? nestedText : null;
}

function normalizeFitmentInput(input: Record<string, unknown>) {
  return {
    ...input,
    wheelOffset: normalizeNumberLike(input.wheelOffset),
    liftHeight: normalizeNumberLike(input.liftHeight)
  };
}

function rewriteAiReport(report: FitmentAiReport, input: Record<string, unknown>): FitmentAiReport {
  const vehicle = {
    year: input.year as number | string | undefined,
    make: typeof input.make === "string" ? input.make : undefined,
    model: typeof input.model === "string" ? input.model : undefined
  };

  return {
    headline: rewriteWrongTruckName(report.headline, vehicle),
    overviewAdvice: rewriteWrongTruckName(report.overviewAdvice, vehicle),
    dailyDrivingAdvice: rewriteWrongTruckName(report.dailyDrivingAdvice, vehicle),
    offRoadAdvice: rewriteWrongTruckName(report.offRoadAdvice, vehicle),
    beforeYouCommit: rewriteWrongTruckName(report.beforeYouCommit, vehicle),
    disclaimer: rewriteWrongTruckName(report.disclaimer, vehicle)
  };
}

function rewriteWrongTruckName(
  text: string,
  input: { year?: number | string; make?: string; model?: string }
) {
  if (!text) return text;
  const make = input.make?.trim().toLowerCase();
  const model = input.model?.trim().toLowerCase();
  if (make === "toyota" && model === "tacoma") return text;

  const name = [input.year, input.make, input.model]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ") || "this truck";

  return text
    .replace(/\bToyota Tacomas\b/gi, `${name}s`)
    .replace(/\bToyota Tacoma\b/gi, name)
    .replace(/\bTacomas\b/gi, `${name}s`)
    .replace(/\bTacoma\b/gi, name);
}

function normalizeNumberLike(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  return value;
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
