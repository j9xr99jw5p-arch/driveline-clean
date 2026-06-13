import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FitmentAiReport, FitmentInput, FitmentReport } from "@/lib/types";

type CallFitmentAiArgs = {
  input: FitmentInput;
  deterministicReport: FitmentReport;
};

type FunctionErrorPayload = {
  error?: string;
  frontendMessage?: string;
  userMessage?: string;
};

export type FitmentAiResult = {
  report: FitmentAiReport | null;
  notice?: string;
};

type LegacyFitmentAiReport = {
  summary?: string;
  fitmentVerdict?: string;
  rubbingExplanation?: string;
  trimmingExplanation?: string;
  dailyDriverNotes?: string;
  recommendations?: string[];
  disclaimer?: string;
};

type PartialFitmentAdvice = Partial<FitmentAiReport> & Partial<LegacyFitmentAiReport>;

export function normalizeAiExplanation(
  ai: PartialFitmentAdvice | null | undefined,
  fallbackReport: FitmentReport
): FitmentAiReport {
  const trimmingText = fallbackReport.trimmingLikely ? "likely need trimming" : "does not look likely to need major trimming";
  const bodyMountText = fallbackReport.bodyMountChopLikely ? "body mount clearance should be checked closely" : "a body mount chop does not look likely from the provided setup";

  return {
    headline:
      ai?.headline ??
      ai?.fitmentVerdict ??
      fallbackReport.verdict,
    overviewAdvice:
      ai?.overviewAdvice ??
      ai?.summary ??
      [
        fallbackReport.explanation,
        `Rubbing risk is ${fallbackReport.rubbingRisk}, and this setup ${trimmingText}.`
      ].join(" "),
    dailyDrivingAdvice:
      ai?.dailyDrivingAdvice ??
      ai?.dailyDriverNotes ??
      "For daily driving, judge this setup by full-lock clearance, rubbing over bumps, and how much trimming you are willing to live with. A clean daily setup should turn quietly and consistently without catching the liner or mud flap area.",
    offRoadAdvice:
      ai?.offRoadAdvice ??
      "Off-road use can reveal clearance problems sooner because the suspension compresses and the tire moves through more of the wheel well. Even if it clears on pavement, bumps, steering angle, and articulation can still create rubbing.",
    beforeYouCommit:
      ai?.beforeYouCommit ??
      [
        `Before committing, verify full-lock clearance, front liner and mud flap clearance, caster and alignment, and the cab mount/body mount area; ${bodyMountText}.`,
        fallbackReport.recommendations.length ? `Also consider: ${fallbackReport.recommendations.join(" ")}` : null
      ].filter(Boolean).join(" "),
    disclaimer:
      ai?.disclaimer ??
      "Estimate only. Final clearance should be verified on the actual vehicle."
  };
}

const modelConfigurationNotice =
  "The AI report model is not configured correctly. Please update the OpenAI model setting.";

export async function callFitmentAi({
  input,
  deterministicReport
}: CallFitmentAiArgs): Promise<FitmentAiResult> {
  const supabase = createSupabaseBrowserClient();

  try {
    const { data, error } = await supabase.functions.invoke("fitment-ai", {
      body: {
        input,
        deterministicReport
      }
    });

    if (error) {
      const payload = await readFunctionErrorPayload(error);
      console.error("fitment-ai function error:", error, payload);

      if (payload?.error === "model_access_error") {
        return {
          report: null,
          notice: payload.frontendMessage ?? modelConfigurationNotice
        };
      }

      return { report: null };
    }

    if (data?.success === false && data?.error === "model_access_error") {
      return {
        report: null,
        notice: data.frontendMessage ?? modelConfigurationNotice
      };
    }

    return { report: data?.aiReport ?? null };
  } catch (error) {
    console.error("fitment-ai function request failed:", error);
    return { report: null };
  }
}

async function readFunctionErrorPayload(error: unknown): Promise<FunctionErrorPayload | null> {
  const context = (error as { context?: Response })?.context;

  if (!context || typeof context.json !== "function") {
    return null;
  }

  try {
    return await context.json();
  } catch (parseError) {
    console.error("fitment-ai function error payload could not be read:", parseError);
    return null;
  }
}
