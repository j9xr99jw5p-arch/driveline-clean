"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VehicleSelect, type VehicleSelection } from "@/components/VehicleSelect";
import { assessFitment, buildPremiumFitmentInsights, buildPremiumWarnings, normalizeFitmentInput } from "@/lib/fitment";
import { callFitmentAi, normalizeAiExplanation } from "@/lib/fitmentAi";
import {
  emptyDescription,
  findMissingSpecs,
  isTacomaCalibrated,
  specFieldLabel,
  type ExtractedSpecs,
  type ExtractionResult,
  type FitmentDescription,
  type SpecField
} from "@/lib/fitmentExtraction";
import { saveFitmentResult, saveTruckProfile } from "@/lib/reportRenderer";
import type { FitmentInput, FitmentReport } from "@/lib/types";
import type { VehicleOptions } from "@/lib/vehicleOptions";

type FitmentFormEntitlement = {
  isAuthenticated: boolean;
  premiumChecksRemaining: number;
  canRunPremiumCheck: boolean;
};

type SpecDraft = {
  currentTireSize: string;
  tireSize: string;
  wheelDiameter: string;
  wheelWidth: string;
  wheelOffset: string;
  liftHeight: string;
  useCase: string;
  rearLoad: string;
  cab: string;
  bed: string;
};

const emptyDraft: SpecDraft = {
  currentTireSize: "",
  tireSize: "",
  wheelDiameter: "",
  wheelWidth: "",
  wheelOffset: "",
  liftHeight: "",
  useCase: "",
  rearLoad: "",
  cab: "",
  bed: ""
};

const genericError = "We’re having trouble generating your fitment report right now.";

export function FitmentForm({
  entitlement,
  vehicleOptions
}: {
  entitlement: FitmentFormEntitlement;
  vehicleOptions?: VehicleOptions;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [vehicle, setVehicle] = useState<VehicleSelection>({ year: "", make: "", model: "" });
  const [description, setDescription] = useState<FitmentDescription>(emptyDescription);
  const [draft, setDraft] = useState<SpecDraft>(emptyDraft);
  const [missingFields, setMissingFields] = useState<SpecField[]>([]);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [extractedKey, setExtractedKey] = useState<string | null>(null);

  const tacomaCalibrated = isTacomaCalibrated(vehicle.make, vehicle.model);
  const descriptionKey = JSON.stringify({ vehicle, description });

  const canDescribe = Boolean(
    vehicle.year && vehicle.make && vehicle.model && description.plannedChanges.trim() && description.usage.trim()
  );

  const draftReady = useMemo(() => {
    return findMissingSpecs(draftToSpecs(draft)).length === 0;
  }, [draft]);

  function updateDescription(field: keyof FitmentDescription, value: string) {
    setDescription((current) => ({ ...current, [field]: value }));
  }

  function updateDraft(field: keyof SpecDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "premium" ? "premium" : "free";

    if (!canDescribe) {
      setStatus("Pick your year, make, and model, then tell us what you want to do and how you use the truck.");
      return;
    }

    if (mode === "premium" && !entitlement.isAuthenticated) {
      router.push("/account?auth=required");
      return;
    }

    if (mode === "premium" && !entitlement.canRunPremiumCheck) {
      setStatus("You do not have any premium checks remaining. Get two premium checks to unlock the full report.");
      return;
    }

    setIsWorking(true);
    setStatus(null);

    try {
      const specs = await resolveSpecs();
      if (!specs) return;

      await generateReport(mode, specs);
    } catch (error) {
      console.error("Fitment check failed", error);
      setStatus(error instanceof Error ? error.message : genericError);
    } finally {
      setIsWorking(false);
    }
  }

  async function resolveSpecs(): Promise<ExtractedSpecs | null> {
    if (extractedKey === descriptionKey && draftReady) {
      return draftToSpecs(draft);
    }

    setStatus("Reading your build...");

    const payload: FitmentDescription = {
      ...description,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model
    };

    try {
      const response = await fetch("/api/fitment/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as ExtractionResult & { error?: string };
      if (!response.ok) throw new Error(result?.error ?? "We couldn’t read that description.");

      const nextDraft = applyExtraction(result.specs, result.interpretation ?? null);
      setExtractedKey(descriptionKey);

      const missing = findMissingSpecs(draftToSpecs(nextDraft));
      if (missing.length) {
        setMissingFields(missing);
        setStatus(`Add ${formatFieldList(missing)} so we can run the check.`);
        return null;
      }

      setMissingFields([]);
      return draftToSpecs(nextDraft);
    } catch (error) {
      console.error("Fitment extraction failed", error);
      const fallback = applyExtraction({}, null);
      setExtractedKey(descriptionKey);
      const missing = findMissingSpecs(draftToSpecs(fallback));
      setMissingFields(missing);
      setStatus("We couldn’t read the specs automatically. Add the setup details below and try again.");
      return null;
    }
  }

  function applyExtraction(specs: ExtractedSpecs, note: string | null) {
    const nextDraft: SpecDraft = {
      currentTireSize: specs.currentTireSize ?? draft.currentTireSize,
      tireSize: specs.tireSize ?? draft.tireSize,
      wheelDiameter: specs.wheelDiameter !== undefined ? String(specs.wheelDiameter) : draft.wheelDiameter,
      wheelWidth: specs.wheelWidth !== undefined ? String(specs.wheelWidth) : draft.wheelWidth,
      wheelOffset: specs.wheelOffset !== undefined ? String(specs.wheelOffset) : draft.wheelOffset,
      liftHeight: specs.liftHeight !== undefined ? String(specs.liftHeight) : draft.liftHeight,
      useCase: specs.useCase ?? draft.useCase,
      rearLoad: specs.rearLoad ?? draft.rearLoad,
      cab: specs.cab ?? draft.cab,
      bed: specs.bed ?? draft.bed
    };

    setDraft(nextDraft);
    setInterpretation(note);
    return nextDraft;
  }

  async function generateReport(mode: "free" | "premium", specs: ExtractedSpecs) {
    setStatus(mode === "premium" ? "Generating premium fitment report..." : "Generating your fitment check...");

    const input = buildFitmentInput(vehicle, description, specs);
    const deterministicReport = assessFitment(input);
    let normalizedAiExplanation = null;

    if (mode === "premium") {
      const aiResult = await callFitmentAi({
        input,
        deterministicReport: {
          ...deterministicReport,
          premiumWarnings: buildPremiumWarnings(input, deterministicReport),
          premiumInsights: buildPremiumFitmentInsights(input, deterministicReport)
        }
      });

      if (!aiResult.report) {
        setStatus(aiResult.notice ?? "We’re having trouble generating the premium AI report right now. No premium check was used.");
        return;
      }

      normalizedAiExplanation = normalizeAiExplanation(aiResult.report, deterministicReport);
    }

    const response = await fetch("/api/fitment/assess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input,
        mode,
        requestId: crypto.randomUUID(),
        aiExplanation: normalizedAiExplanation
      })
    });
    const payload = await response.json();

    if (!response.ok) throw new Error(payload?.error ?? genericError);

    if (payload.garageSyncError) {
      sessionStorage.setItem("drivelineReportNotice", "We’re having trouble saving your garage details right now. Your fitment report is still available.");
    }

    saveFitmentResult(input, payload.report as FitmentReport);
    saveTruckProfile(input);
    router.push("/results");
  }

  async function startCheckout() {
    if (!entitlement.isAuthenticated) {
      router.push("/account?auth=required");
      return;
    }

    setIsCheckingOut(true);
    setStatus(null);

    try {
      const response = await fetch("/api/checkout/fitment-credits", { method: "POST" });
      const payload = await response.json();

      if (!response.ok || !payload?.url) {
        if (payload?.redirectUrl) {
          router.push(payload.redirectUrl);
          return;
        }

        throw new Error(payload?.error ?? "We’re having trouble opening checkout right now.");
      }

      window.location.assign(payload.url);
    } catch (error) {
      console.error("Fitment credits checkout failed", error);
      setStatus(error instanceof Error ? error.message : "We’re having trouble opening checkout right now.");
      setIsCheckingOut(false);
    }
  }

  return (
    <>
      <form className="verify-form" onSubmit={onSubmit}>
        <VehicleSelect vehicleOptions={vehicleOptions} onChange={setVehicle} />

        <label className="field">
          <span>Trim</span>
          <input
            placeholder="TRD Off-Road, SR5, Lariat, Rubicon..."
            value={description.trim}
            onChange={(event) => updateDescription("trim", event.target.value)}
          />
        </label>

        {vehicle.make && vehicle.model && !tacomaCalibrated ? (
          <p className="check-calibration-note">
            Heads up: Driveline’s clearance thresholds are calibrated on Toyota Tacoma data. We’ll still run your{" "}
            {vehicle.make} {vehicle.model}, but treat the result as a rough estimate until we have verified builds for it.
          </p>
        ) : null}

        <label className="field">
          <span>What do you want to do to the truck?</span>
          <textarea
            className="verify-spec"
            placeholder="Example: I want to run 285/70R17 KO2s on 17x8.5 wheels with -12 offset and a 3 inch lift."
            value={description.plannedChanges}
            onChange={(event) => updateDescription("plannedChanges", event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>What have you already done?</span>
          <textarea
            className="verify-spec"
            placeholder="Example: Still on stock 265/70R16 tires and stock suspension. Added a front bumper last year."
            value={description.currentSetup}
            onChange={(event) => updateDescription("currentSetup", event.target.value)}
          />
        </label>

        <label className="field">
          <span>How do you use the truck?</span>
          <textarea
            className="verify-spec"
            placeholder="Example: Daily commute during the week, forest roads and camping most weekends."
            value={description.usage}
            onChange={(event) => updateDescription("usage", event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Build goals</span>
          <textarea
            className="verify-note"
            placeholder="Example: Biggest tire I can run without cutting anything, and I want it to stay quiet on the highway."
            value={description.buildGoals}
            onChange={(event) => updateDescription("buildGoals", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Anything else we should know?</span>
          <textarea
            className="verify-note"
            placeholder="Example: I keep a rooftop tent and drawers in the bed year round."
            value={description.extraNotes}
            onChange={(event) => updateDescription("extraNotes", event.target.value)}
          />
        </label>

        {interpretation ? <p className="check-interpretation">{interpretation}</p> : null}

        {missingFields.length ? (
          <div className="check-follow-up">
            <p className="check-missing-note">
              We need {formatFieldList(missingFields)} to finish the check. Add {missingFields.length === 1 ? "it" : "them"} below — everything else can stay in the boxes above.
            </p>
            <div className={missingFields.length > 2 ? "check-spec-grid" : "verify-vehicle-grid"}>
              {missingFields.map((field) => (
                <label className="field" key={field}>
                  <span>{specFieldLabel(field)}</span>
                  <input
                    value={String(draft[field] ?? "")}
                    onChange={(event) => updateDraft(field, event.target.value)}
                    placeholder={missingPlaceholder(field)}
                    required
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="check-actions">
          <button className="button full" type="submit" name="mode" value="free" disabled={isWorking || !canDescribe}>
            {isWorking ? "Working..." : "Get Basic Result - Free"}
          </button>
          <button
            className="button primary full"
            type="submit"
            name="mode"
            value="premium"
            disabled={isWorking || !canDescribe || !entitlement.canRunPremiumCheck}
          >
            {isWorking ? "Working..." : "Use 1 Premium Check"}
          </button>
        </div>

        {!canDescribe ? (
          <p className="verify-hint">Pick your year, make, and model, then tell us your plan and how you use the truck.</p>
        ) : null}
      </form>

      {status ? <p className="verify-status">{status}</p> : null}
      <PremiumCard entitlement={entitlement} isCheckingOut={isCheckingOut} onCheckout={startCheckout} />
    </>
  );
}

function PremiumCard({
  entitlement,
  isCheckingOut,
  onCheckout
}: {
  entitlement: FitmentFormEntitlement;
  isCheckingOut: boolean;
  onCheckout: () => void;
}) {
  return (
    <div className="check-premium-card">
      <p className="eyebrow">Premium access</p>
      <h3>Two Premium Fitment Checks</h3>
      <p className="muted">$14 one-time. Includes two full fitment reports and Verified Builds access under the current access policy.</p>
      <div className="spec-row">
        <span className="muted">Premium checks remaining</span>
        <strong>{entitlement.premiumChecksRemaining}</strong>
      </div>
      <button className="button full" type="button" onClick={onCheckout} disabled={isCheckingOut}>
        {isCheckingOut ? "Opening checkout..." : "Get 2 Premium Checks"}
      </button>
    </div>
  );
}

function buildFitmentInput(vehicle: VehicleSelection, description: FitmentDescription, specs: ExtractedSpecs): FitmentInput {
  return normalizeFitmentInput({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    trim: description.trim.trim() || "Not specified",
    cab: specs.cab || "Not specified",
    bed: specs.bed || "Not specified",
    currentTireSize: specs.currentTireSize,
    tireSize: specs.tireSize,
    wheelDiameter: specs.wheelDiameter,
    wheelWidth: specs.wheelWidth,
    wheelOffset: specs.wheelOffset,
    liftHeight: specs.liftHeight,
    useCase: specs.useCase || "mixed",
    rearLoad: specs.rearLoad || "normal",
    buildGoals: [description.buildGoals, description.usage, description.extraNotes]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 1200)
  });
}

function draftToSpecs(draft: SpecDraft): ExtractedSpecs {
  return {
    currentTireSize: draft.currentTireSize.trim() || undefined,
    tireSize: draft.tireSize.trim() || undefined,
    wheelDiameter: parseOptionalNumber(draft.wheelDiameter),
    wheelWidth: parseOptionalNumber(draft.wheelWidth),
    wheelOffset: parseOptionalNumber(draft.wheelOffset),
    liftHeight: parseOptionalNumber(draft.liftHeight),
    useCase: draft.useCase.trim() || undefined,
    rearLoad: draft.rearLoad.trim() || undefined,
    cab: draft.cab.trim() || undefined,
    bed: draft.bed.trim() || undefined
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function missingPlaceholder(field: SpecField) {
  const placeholders: Record<SpecField, string> = {
    currentTireSize: "265/70R17",
    tireSize: "285/70R17",
    wheelDiameter: "17",
    wheelWidth: "8.5",
    wheelOffset: "-12",
    liftHeight: "2.5",
    useCase: "daily, mixed, or off-road",
    rearLoad: "normal, sometimes-heavy, or constant-heavy",
    cab: "Double Cab",
    bed: "5 ft"
  };

  return placeholders[field];
}

function formatFieldList(fields: SpecField[]) {
  const labels = fields.map((field) => specFieldLabel(field).toLowerCase());
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}
