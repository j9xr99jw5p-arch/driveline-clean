"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { assessFitment, normalizeFitmentInput } from "@/lib/fitment";
import { callFitmentAi, normalizeAiExplanation } from "@/lib/fitmentAi";
import { loadTruckProfile, saveFitmentResult, saveTruckProfile } from "@/lib/reportRenderer";
import type { FitmentInput, FitmentReport } from "@/lib/types";

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

export function FitmentForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [profile, setProfile] = useState<FitmentInput | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setProfile(loadTruckProfile());
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus("Generating fitment report");
    const formData = new FormData(event.currentTarget);
    const input = normalizeFitmentInput(Object.fromEntries(formData));
    const deterministicReport = assessFitment(input);

    setStatus("Generating fitment report");
    const aiResult = await callFitmentAi({
      input,
      deterministicReport
    });
    const aiExplanation = aiResult.report;
    const normalizedAiExplanation = normalizeAiExplanation(aiExplanation, deterministicReport);
    const finalReport: FitmentReport = {
      ...deterministicReport,
      aiExplanation: normalizedAiExplanation
    };

    saveFitmentResult(input, finalReport);
    saveTruckProfile(input);
    setProfile(input);

    if (!aiExplanation) {
      sessionStorage.setItem(
        "drivelineReportNotice",
        aiResult.notice ?? "We’re having trouble generating your full fitment report right now. We’re working to fix it as quickly as possible. Please try again in a moment."
      );
    }

    try {
      const response = await fetch("/api/fitment/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, aiExplanation: normalizedAiExplanation })
      });
      const payload = await response.json();
      if (!response.ok) {
        sessionStorage.setItem("drivelineReportNotice", "We’re having trouble saving your fitment report right now. Your report is still available on this device.");
      } else if (payload.garageSyncError) {
        sessionStorage.setItem("drivelineReportNotice", "We’re having trouble saving your garage details right now. Your fitment report is still available.");
      }
    } catch (error) {
      console.error("Could not save fitment report", error);
      sessionStorage.setItem("drivelineReportNotice", "We’re having trouble saving your fitment report right now. Your report is still available on this device.");
    } finally {
      router.push("/results");
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
        <button className="button primary full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Generating fitment report" : "Generate Fitment Report"}</button>
      </form>
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
