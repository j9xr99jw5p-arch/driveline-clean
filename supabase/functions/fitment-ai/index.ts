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
      recommendations: deterministicReport.recommendations
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

    return jsonResponse({ success: true, aiReport });
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
            "You are a Toyota Tacoma wheel, tire, and lift fitment advisor for Driveline. Write practical conversational advice. The deterministic fitment report is the source of truth. Do not contradict it. Return only valid JSON with the required keys."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Create conversational paragraph-based fitment advice.",
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
