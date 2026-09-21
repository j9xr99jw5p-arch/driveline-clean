"use client";

import { useEffect, useMemo, useState } from "react";
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
import { emptyFitmentVisualizeResult, type FitmentVisualizeResult } from "@/lib/fitmentVisualize";
import { saveFitmentResult, saveTruckProfile } from "@/lib/reportRenderer";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FitmentInput, FitmentReport } from "@/lib/types";
import type { VehicleOptions } from "@/lib/vehicleOptions";

type FitmentFormEntitlement = {
  isAuthenticated: boolean;
  premiumChecksRemaining: number;
  canRunPremiumCheck: boolean;
};

type FitmentFormFreeChecks = {
  limit: number;
  remaining: number;
  canRunFreeCheck: boolean;
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
const maxPhotos = 3;
const maxPhotoBytes = 8 * 1024 * 1024;
const fitmentPhotosBucket =
  process.env.NEXT_PUBLIC_SUPABASE_FITMENT_PHOTOS_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_BUILD_PHOTOS_BUCKET ||
  "verified-build-photos";

export function FitmentForm({
  entitlement,
  freeChecks,
  vehicleOptions
}: {
  entitlement: FitmentFormEntitlement;
  freeChecks: FitmentFormFreeChecks;
  vehicleOptions?: VehicleOptions;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [vehicle, setVehicle] = useState<VehicleSelection>({ year: "", make: "", model: "" });
  const [description, setDescription] = useState<FitmentDescription>(emptyDescription);
  const [draft, setDraft] = useState<SpecDraft>(emptyDraft);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [missingFields, setMissingFields] = useState<SpecField[]>([]);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [extractedKey, setExtractedKey] = useState<string | null>(null);

  const tacomaCalibrated = isTacomaCalibrated(vehicle.make, vehicle.model);
  const descriptionKey = JSON.stringify({ vehicle, description });

  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  const canDescribe = Boolean(
    vehicle.year &&
    vehicle.make &&
    vehicle.model &&
    photos.length >= 1 &&
    description.plannedChanges.trim() &&
    description.usage.trim()
  );
  const canRunCheck = freeChecks.canRunFreeCheck || entitlement.canRunPremiumCheck;

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

    if (!canDescribe) {
      setStatus("Add 1 to 3 photos, pick your year, make, and model, then tell us what you want to do and how you use the truck.");
      return;
    }

    if (!canRunCheck) {
      setStatus("You’ve used your 3 free fitment checks. Get 2 more checks for $14.");
      return;
    }

    if (!freeChecks.canRunFreeCheck && !entitlement.isAuthenticated) {
      router.push("/account?auth=required");
      return;
    }

    setIsWorking(true);
    setStatus(null);

    try {
      setStatus("Reading your build...");
      const [photoUrls, specs] = await Promise.all([uploadCheckPhotos(photos), resolveSpecs()]);
      if (!specs) return;

      await generateReport(specs, photoUrls);
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

  async function generateReport(specs: ExtractedSpecs, photoUrls: string[]) {
    const input = buildFitmentInput(vehicle, description, specs);
    const deterministicReport = assessFitment(input);
    const reportInput = {
      input,
      deterministicReport: {
        ...deterministicReport,
        premiumWarnings: buildPremiumWarnings(input, deterministicReport),
        premiumInsights: buildPremiumFitmentInsights(input, deterministicReport)
      }
    };

    setStatus(photoUrls.length ? "Rendering your truck..." : "Building your fitment report...");

    const [aiResult, visualization] = await Promise.all([
      callFitmentAi(reportInput),
      visualizeTruck(photoUrls, input)
    ]);
    const normalizedAiExplanation = aiResult.report
      ? normalizeAiExplanation(aiResult.report, deterministicReport, input)
      : normalizeAiExplanation(null, deterministicReport, input);

    if (aiResult.notice) {
      sessionStorage.setItem("drivelineReportNotice", aiResult.notice);
    }

    setStatus("Building your fitment report...");

    const response = await fetch("/api/fitment/assess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input,
        requestId: crypto.randomUUID(),
        aiExplanation: normalizedAiExplanation
      })
    });
    const payload = await response.json();

    if (!response.ok) throw new Error(payload?.error ?? genericError);

    if (payload.garageSyncError) {
      sessionStorage.setItem("drivelineReportNotice", "We’re having trouble saving your garage details right now. Your fitment report is still available.");
    }

    saveFitmentResult(input, payload.report as FitmentReport, visualization);
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
        <label className="field">
          <span>Photos</span>
          <input
            name="check-photos"
            type="file"
            accept="image/*"
            multiple
            required={photos.length === 0}
            onChange={(event) => {
              const next = onPhotosSelected(event.target.files, photos);
              setPhotos(next.files);
              if (next.error) setStatus(next.error);
              event.target.value = "";
            }}
          />
        </label>
        {photos.length ? (
          <div className="check-photo-grid">
            {photos.map((file, index) => (
              <figure className="check-photo-tile" key={`${file.name}-${file.size}-${index}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviews[index]} alt={`Truck photo ${index + 1}`} />
                <button
                  className="check-photo-remove"
                  type="button"
                  onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}
                >
                  Remove
                </button>
              </figure>
            ))}
          </div>
        ) : null}

        <VehicleSelect vehicleOptions={vehicleOptions} onChange={setVehicle} />

        <label className="field">
          <span>Trim</span>
          <input
            placeholder="TRD Off-Road, Lariat, Rubicon..."
            value={description.trim}
            onChange={(event) => updateDescription("trim", event.target.value)}
          />
        </label>

        {vehicle.make && vehicle.model && !tacomaCalibrated ? (
          <p className="check-calibration-note">
            Estimate only — clearance data is calibrated on Tacoma builds.
          </p>
        ) : null}

        <label className="field">
          <span>What do you want to do?</span>
          <textarea
            className="verify-spec"
            placeholder="285/70R17 KO2s, 17x8.5, -12 offset, 3 inch lift."
            value={description.plannedChanges}
            onChange={(event) => updateDescription("plannedChanges", event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>What’s on it now?</span>
          <textarea
            className="verify-spec"
            placeholder="Stock tires and suspension."
            value={description.currentSetup}
            onChange={(event) => updateDescription("currentSetup", event.target.value)}
          />
        </label>

        <label className="field">
          <span>How do you use it?</span>
          <textarea
            className="verify-spec"
            placeholder="Daily driver, forest roads on weekends."
            value={description.usage}
            onChange={(event) => updateDescription("usage", event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Anything else?</span>
          <textarea
            className="verify-note"
            placeholder="Rooftop tent, no cutting, quiet on the highway..."
            value={description.extraNotes}
            onChange={(event) => updateDescription("extraNotes", event.target.value)}
          />
        </label>

        {interpretation ? <p className="check-interpretation">{interpretation}</p> : null}

        {missingFields.length ? (
          <div className="check-follow-up">
            <p className="check-missing-note">
              Add {formatFieldList(missingFields)} to finish.
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
          <button className="button primary full" type="submit" disabled={isWorking || !canDescribe || !canRunCheck}>
            {isWorking ? "Working..." : "Run Fitment Check"}
          </button>
        </div>

        <p className="verify-hint">
          {checkHint(freeChecks, entitlement)}
        </p>
      </form>

      {status ? <p className="verify-status">{status}</p> : null}
      {!canRunCheck ? (
        <MoreChecksCard entitlement={entitlement} isCheckingOut={isCheckingOut} onCheckout={startCheckout} />
      ) : null}
    </>
  );
}

function checkHint(
  freeChecks: FitmentFormFreeChecks,
  entitlement: FitmentFormEntitlement
) {
  if (freeChecks.canRunFreeCheck) {
    return `${freeChecks.remaining} of ${freeChecks.limit} free checks left.`;
  }

  if (entitlement.canRunPremiumCheck) {
    return `${entitlement.premiumChecksRemaining} paid ${entitlement.premiumChecksRemaining === 1 ? "check" : "checks"} remaining.`;
  }

  return "You’ve used your 3 free checks. Get 2 more for $14.";
}

function MoreChecksCard({
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
      <p className="eyebrow">Need another check?</p>
      <h3>Two more fitment checks</h3>
      <p className="muted">$14 one-time. Same full report, plus the verified builds library.</p>
      <div className="spec-row">
        <span className="muted">Paid checks remaining</span>
        <strong>{entitlement.premiumChecksRemaining}</strong>
      </div>
      <button className="button full" type="button" onClick={onCheckout} disabled={isCheckingOut}>
        {isCheckingOut ? "Opening checkout..." : "Get 2 more checks"}
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
    plannedChanges: description.plannedChanges.trim().slice(0, 800) || undefined,
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

function onPhotosSelected(fileList: FileList | null, current: File[]) {
  const incoming = Array.from(fileList ?? []).filter((file) => file.type.startsWith("image/"));
  if (!incoming.length) {
    return { files: current, error: current.length ? null : "Choose a photo of your truck." };
  }

  const oversized = incoming.find((file) => file.size > maxPhotoBytes);
  if (oversized) {
    return { files: current, error: "Each photo needs to be under 8 MB." };
  }

  const merged = [...current];
  for (const file of incoming) {
    if (merged.length >= maxPhotos) break;
    if (merged.some((existing) => existing.name === file.name && existing.size === file.size)) continue;
    merged.push(file);
  }

  return {
    files: merged,
    error: current.length + incoming.length > maxPhotos ? "We kept the first 3 photos." : null
  };
}

async function uploadCheckPhotos(files: File[]) {
  if (!files.length) return [];

  try {
    const prepareResponse = await fetch("/api/fitment/photo-uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        checkId: crypto.randomUUID(),
        files: files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size
        }))
      })
    });
    const preparePayload = (await prepareResponse.json()) as {
      uploads?: Array<{ path: string; token: string; publicUrl: string; bucket?: string }>;
      bucket?: string;
      error?: string;
    };

    if (!prepareResponse.ok || !preparePayload.uploads?.length) {
      console.error("Fitment photo upload setup failed", preparePayload);
      return [];
    }

    const supabase = createSupabaseBrowserClient();
    const bucket = preparePayload.bucket || fitmentPhotosBucket;
    const urls: string[] = [];

    for (const [index, upload] of preparePayload.uploads.entries()) {
      const file = files[index];
      if (!file) continue;

      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(upload.path, upload.token, file);
      if (error) {
        console.error("Fitment photo upload failed", error);
        continue;
      }

      urls.push(upload.publicUrl);
    }

    return urls;
  } catch (error) {
    console.error("Fitment photo upload crashed", error);
    return [];
  }
}

async function visualizeTruck(photoUrls: string[], input: FitmentInput): Promise<FitmentVisualizeResult> {
  if (!photoUrls.length) {
    return { ...emptyFitmentVisualizeResult, sourcePhotoUrls: photoUrls };
  }

  try {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 110000);
    const response = await fetch("/api/fitment/visualize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ photoUrls, input }),
      signal: controller.signal
    }).finally(() => window.clearTimeout(timeout));
    const payload = (await response.json()) as FitmentVisualizeResult;
    const generatedImageUrls = payload.generatedImageUrls?.length
      ? payload.generatedImageUrls
      : payload.generatedImageUrl
        ? [payload.generatedImageUrl]
        : [];
    return {
      generatedImageUrl: generatedImageUrls[0] ?? null,
      generatedImageUrls,
      sourcePhotoUrls: payload.sourcePhotoUrls?.length ? payload.sourcePhotoUrls : photoUrls,
      alreadyModified: payload.alreadyModified === true,
      vision: payload.vision ?? null
    };
  } catch (error) {
    console.error("Fitment visualize request failed", error);
    return { ...emptyFitmentVisualizeResult, sourcePhotoUrls: photoUrls };
  }
}
