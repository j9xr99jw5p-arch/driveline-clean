"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const friendlyErrorMessage =
  "We’re having trouble submitting your build right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

const years = Array.from({ length: 18 }, (_, index) => String(2026 - index));
const trims = ["", "SR", "SR5", "TRD Sport", "TRD Off-Road", "TRD Pro", "Limited", "Trail Edition", "Other"];
const cabs = ["", "Access Cab", "Double Cab", "Crew Cab", "Other"];
const beds = ["", "5 foot", "6 foot", "Short bed", "Long bed", "Other"];
const rubbingOptions = ["", "None", "Minor", "Moderate", "Severe", "Unknown"];
const yesNoUnknownOptions = ["Unknown", "Yes", "No"];
const riskOptions = ["Unknown", "Low", "Medium", "High"];

export function SubmitBuildForm() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/submit-build", {
        method: "POST",
        body: new FormData(form)
      });

      const payload = await response.json().catch((error) => {
        console.error("Build submission response could not be read", error);
        return {};
      });

      if (!response.ok) {
        console.error("Build submission failed", payload);
        setStatus(typeof payload.error === "string" ? payload.error : friendlyErrorMessage);
        return;
      }

      router.push("/submit-build/thank-you");
    } catch (error) {
      console.error("Build submission request failed", error);
      setStatus(friendlyErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="card form" onSubmit={onSubmit} encType="multipart/form-data">
      <FormSection title="Contact Info" copy="We’ll use this only to contact you about your build card.">
        <Field name="contactEmail" label="Contact email" placeholder="you@example.com" type="email" required />
        <div className="grid two">
          <Field name="ownerName" label="Owner name" placeholder="Your name" required={false} />
          <Field name="socialHandle" label="Instagram/social handle" placeholder="@username" required={false} />
        </div>
      </FormSection>

      <FormSection title="Vehicle Info">
        <div className="grid two">
          <Select name="year" label="Vehicle year" options={years} defaultValue="2024" required />
          <Field name="make" label="Make" defaultValue="Toyota" required />
        </div>
        <div className="grid two">
          <Field name="model" label="Model" defaultValue="Tacoma" required />
          <Select name="trim" label="Trim" options={trims} required={false} />
        </div>
        <div className="grid two">
          <Select name="cab" label="Cab" options={cabs} required={false} />
          <Select name="bed" label="Bed length" options={beds} required={false} />
        </div>
      </FormSection>

      <FormSection title="Wheels & Tires">
        <div className="grid two">
          <Field name="tireBrand" label="Tire brand" placeholder="Falken" required={false} />
          <Field name="tireModel" label="Tire model" placeholder="Wildpeak A/T4W" required={false} />
        </div>
        <Field name="tireSize" label="Tire size" placeholder="285/70R17" required />
        <div className="grid two">
          <Field name="wheelBrand" label="Wheel brand" placeholder="Method" required={false} />
          <Field name="wheelModel" label="Wheel model" placeholder="316" required={false} />
        </div>
        <div className="grid two">
          <Field name="wheelSize" label="Wheel size" placeholder="17x8.5" required={false} />
          <Field name="wheelOffset" label="Wheel offset" placeholder="-12" type="number" required={false} />
        </div>
      </FormSection>

      <FormSection title="Suspension & Clearance">
        <div className="grid two">
          <Field name="liftHeight" label="Lift height" placeholder="2.5" type="number" step="0.25" required={false} />
          <Field name="suspensionType" label="Suspension type" placeholder="Level kit" required={false} />
        </div>
        <div className="grid two">
          <Field name="suspensionBrand" label="Suspension brand" placeholder="Fox" required={false} />
          <Field name="suspensionModel" label="Suspension model" placeholder="2.5" required={false} />
        </div>
        <Field name="suspensionSetup" label="Suspension setup/details" placeholder="Coilovers, UCAs, rear leafs, spacers, etc." required={false} />
        <Select name="rubbingSeverity" label="How bad is the rubbing?" options={rubbingOptions} required={false} />
        <div className="grid two">
          <Select name="trimmingRequired" label="Trimming required?" options={yesNoUnknownOptions} defaultValue="Unknown" required={false} />
          <Select name="bodyMountChop" label="Body mount chop done?" options={yesNoUnknownOptions} defaultValue="Unknown" required={false} />
        </div>
        <Select name="fitmentRisk" label="Fitment risk" options={riskOptions} defaultValue="Unknown" required={false} />
        <label className="field">
          <span>Fitment/rubbing notes</span>
          <textarea name="fitmentNotes" placeholder="Describe rubbing, trimming, alignment, wheel spacers, payload, or anything that affects clearance." />
        </label>
      </FormSection>

      <FormSection title="Extra Build Details">
        <Field name="sourceUrl" label="Source URL, if applicable" placeholder="https://..." type="url" required={false} />
        <label className="field">
          <span>Full build list / extra notes</span>
          <textarea name="fullBuildList" placeholder="Already have your setup written out? Paste the full build list here." />
          <small className="fine">Already have your setup written out? Paste the full build list here.</small>
        </label>
      </FormSection>

      <FormSection title="Upload File" copy="You can attach a screenshot, notes file, spec sheet, or photos that include your build details.">
        <label className="field">
          <span>Optional file attachment</span>
          <input name="attachment" type="file" accept="image/*,.pdf,.txt,.doc,.docx" />
          <small className="fine">Attach a screenshot, notes file, spec sheet, or photo that includes your build details.</small>
        </label>
      </FormSection>

      <button className="button primary full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Build"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}

function FormSection({ title, copy, children }: { title: string; copy?: string; children: React.ReactNode }) {
  return (
    <section className="form-section">
      <div>
        <h3>{title}</h3>
        {copy ? <p className="muted">{copy}</p> : null}
      </div>
      {children}
    </section>
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
  defaultValue,
  required = true
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} required={required}>
        {options.map((option) => <option key={option || "blank"} value={option}>{option || "Select one"}</option>)}
      </select>
    </label>
  );
}
