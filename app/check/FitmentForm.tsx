"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assessFitment, buildPremiumFitmentInsights, buildPremiumWarnings, normalizeFitmentInput } from "@/lib/fitment";
import { callFitmentAi, normalizeAiExplanation } from "@/lib/fitmentAi";
import { loadTruckProfile, saveFitmentResult, saveTruckProfile } from "@/lib/reportRenderer";
import type { FitmentInput, FitmentReport } from "@/lib/types";

type FitmentFormEntitlement = {
  isAuthenticated: boolean;
  premiumChecksRemaining: number;
  canRunPremiumCheck: boolean;
};

const years = Array.from({ length: 8 }, (_, index) => String(2023 - index));
const trims = ["SR", "SR5", "TRD Sport", "TRD Off-Road", "TRD Pro", "Limited"];
const cabs = ["Access Cab", "Double Cab"];
const beds = ["5 ft", "6 ft"];
const wheelDiameters = ["16", "17", "18"];
const wheelWidths = ["7", "7.5", "8", "8.5", "9", "9.5", "10"];
const liftHeights = ["0", "1", "1.5", "2", "2.5", "3", "3.5"];
const useCases = [
  { value: "daily", label: "Daily driver" },
  { value: "mixed", label: "Mixed street and trail" },
  { value: "off-road", label: "Trail focused" }
];
const rearLoads = [
  { value: "normal", label: "No regular rear weight" },
  { value: "sometimes-heavy", label: "Occasional camping or gear load" },
  { value: "constant-heavy", label: "Constant rack, drawers, bumper, or tools" }
];

export function FitmentForm({ entitlement }: { entitlement: FitmentFormEntitlement }) {
  const [status, setStatus] = useState<string | null>(null);
  const [profile, setProfile] = useState<FitmentInput | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setProfile(loadTruckProfile());
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "premium" ? "premium" : "free";

    if (mode === "premium" && !entitlement.isAuthenticated) {
      router.push("/account?auth=required");
      return;
    }

    if (mode === "premium" && !entitlement.canRunPremiumCheck) {
      setStatus("You do not have any premium checks remaining. Get two premium checks to unlock the full report.");
      return;
    }

    setIsSubmitting(true);
    setStatus(mode === "premium" ? "Generating premium fitment report" : "Generating free fitment check");
    const formData = new FormData(event.currentTarget);
    const input = normalizeFitmentInput(Object.fromEntries(formData));
    const deterministicReport = assessFitment(input);
    let normalizedAiExplanation = null;

    try {
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
      if (!response.ok) {
        throw new Error(payload?.error ?? "We’re having trouble generating your fitment report right now.");
      } else if (payload.garageSyncError) {
        sessionStorage.setItem("drivelineReportNotice", "We’re having trouble saving your garage details right now. Your fitment report is still available.");
      }

      const finalReport = payload.report as FitmentReport;
      saveFitmentResult(input, finalReport);
      saveTruckProfile(input);
      setProfile(input);
      router.push("/results");
    } catch (error) {
      console.error("Could not save fitment report", error);
      setStatus(error instanceof Error ? error.message : "We’re having trouble generating your fitment report right now.");
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="card">
      <form className="form" onSubmit={onSubmit} key={profile ? JSON.stringify(profile) : "empty-profile"}>
        <div className="grid two">
          <Select name="year" label="Tacoma year" options={years} defaultValue={String(profile?.year ?? "2023")} />
          <Select name="trim" label="Trim" options={trims} defaultValue={profile?.trim ?? "TRD Off-Road"} />
        </div>
        <div className="grid two">
          <Select name="cab" label="Cab" options={cabs} defaultValue={profile?.cab ?? "Double Cab"} />
          <Select name="bed" label="Bed" options={beds} defaultValue={profile?.bed ?? "5 ft"} />
        </div>
        <div className="grid two">
          <Field name="currentTireSize" label="Current tire size" placeholder="265/70R17" defaultValue={profile?.currentTireSize ?? ""} required={false} />
          <Field name="tireSize" label="Desired tire size" defaultValue={profile?.tireSize ?? "285/70R17"} />
        </div>
        <div className="grid three">
          <Select name="wheelDiameter" label="Wheel diameter" options={wheelDiameters} defaultValue={String(profile?.wheelDiameter ?? "17")} />
          <Select name="wheelWidth" label="Wheel width" options={wheelWidths} defaultValue={String(profile?.wheelWidth ?? "8.5")} />
          <Field name="wheelOffset" label="Wheel offset" defaultValue={String(profile?.wheelOffset ?? "-12")} type="number" />
        </div>
        <div className="grid two">
          <Select name="liftHeight" label="Lift height" options={liftHeights} defaultValue={String(profile?.liftHeight ?? "2.5")} />
          <Select name="useCase" label="Use case" options={useCases} defaultValue={profile?.useCase ?? "mixed"} />
        </div>
        <Select name="rearLoad" label="Rear weight/load" options={rearLoads} defaultValue={profile?.rearLoad ?? "normal"} />
        <label className="field">
          <span>Build goals</span>
          <textarea name="buildGoals" defaultValue={profile?.buildGoals ?? ""} placeholder="Daily comfort, 33s, overland weight, less trimming, etc." />
        </label>
        <div className="grid two">
          <button className="button full" type="submit" name="mode" value="free" disabled={isSubmitting}>
            {isSubmitting ? "Generating..." : "Get Basic Result - Free"}
          </button>
          <button className="button primary full" type="submit" name="mode" value="premium" disabled={isSubmitting || !entitlement.canRunPremiumCheck}>
            {isSubmitting ? "Generating..." : "Use 1 Premium Check"}
          </button>
        </div>
      </form>
      <div className="card" style={{ marginTop: 16 }}>
        <p className="eyebrow">Premium access</p>
        <h3>Two Premium Fitment Checks</h3>
        <p className="muted">$14 one-time. Includes two full fitment reports and Verified Builds access under the current access policy.</p>
        <div className="spec-row"><span className="muted">Premium checks remaining</span><strong>{entitlement.premiumChecksRemaining}</strong></div>
        <button className="button primary full" type="button" onClick={startCheckout} disabled={isCheckingOut}>
          {isCheckingOut ? "Opening checkout..." : "Get 2 Premium Checks"}
        </button>
      </div>
      {status ? <p className="muted" style={{ marginTop: 16 }}>{status}</p> : null}
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  const { label, required = true, ...inputProps } = props;
  return <label className="field"><span>{label}</span><input {...inputProps} required={required} /></label>;
}

function Select({
  name,
  label,
  options,
  defaultValue
}: {
  name: string;
  label: string;
  options: Array<string | { value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} required>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return <option key={value} value={value}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}
