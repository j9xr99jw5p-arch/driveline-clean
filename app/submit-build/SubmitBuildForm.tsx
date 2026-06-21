"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const friendlyErrorMessage =
  "We’re having trouble submitting your build right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

const years = Array.from({ length: 18 }, (_, index) => String(2026 - index));
const trims = ["", "SR", "SR5", "TRD Sport", "TRD Off-Road", "TRD Pro", "Limited", "Trail Edition", "Other"];
const cabs = ["", "Access Cab", "Double Cab", "Crew Cab", "Other"];
const beds = ["", "5 foot", "6 foot", "Short bed", "Long bed", "Other"];
const rubbingOptions = ["", "None", "Minor", "Moderate", "Severe", "Unknown"];
const yesNoUnknownOptions = ["", "Unknown", "Yes", "No"];
const riskOptions = ["Unknown", "Low", "Medium", "High"];
const buildPhotosBucket = process.env.NEXT_PUBLIC_SUPABASE_BUILD_PHOTOS_BUCKET || "verified-build-photos";

type RequiredState = {
  year: string;
  make: string;
  model: string;
  socialHandle: string;
  tireSize: string;
  wheelSize: string;
  liftHeight: string;
  suspensionSetup: string;
  rubbingSeverity: string;
  trimmingRequired: string;
  bodyMountChop: string;
};

const initialRequiredState: RequiredState = {
  year: "2024",
  make: "Toyota",
  model: "Tacoma",
  socialHandle: "",
  tireSize: "",
  wheelSize: "",
  liftHeight: "",
  suspensionSetup: "",
  rubbingSeverity: "",
  trimmingRequired: "",
  bodyMountChop: ""
};

export function SubmitBuildForm() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiredState, setRequiredState] = useState<RequiredState>(initialRequiredState);

  const canSubmit = useMemo(() => {
    return Boolean(
      requiredState.year.trim() &&
      requiredState.make.trim() &&
      requiredState.model.trim() &&
      requiredState.socialHandle.trim() &&
      requiredState.tireSize.trim() &&
      requiredState.wheelSize.trim() &&
      (requiredState.suspensionSetup.trim() || requiredState.liftHeight.trim()) &&
      requiredState.rubbingSeverity.trim() &&
      requiredState.trimmingRequired.trim() &&
      requiredState.bodyMountChop.trim()
    );
  }, [requiredState]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!canSubmit) {
      setStatus("Please complete the required vehicle, fitment, clearance, and social handle fields.");
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const submitData = new FormData(form);
      const files = submitData
        .getAll("attachment")
        .filter((value): value is File => value instanceof File && value.size > 0);
      submitData.delete("attachment");

      const response = await fetch("/api/submit-build", {
        method: "POST",
        body: submitData
      });

      const text = await response.text();
      let payload: { ok?: boolean; id?: string; error?: string; message?: string; raw?: string } | null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }

      if (!response.ok) {
        console.error("Build submission failed", {
          status: response.status,
          statusText: response.statusText,
          response: payload
        });
        throw new Error(response.status >= 500 ? friendlyErrorMessage : payload?.error || payload?.message || "Build submission failed");
      }

      if (payload?.id && files.length > 0) {
        await uploadBuildFiles(payload.id, files);
      }

      router.push("/submit-build/thank-you");
    } catch (error) {
      console.error("Build submission request failed", error);
      setStatus(error instanceof Error && error.message !== "Build submission failed" ? error.message : friendlyErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadBuildFiles(buildId: string, files: File[]) {
    const prepareResponse = await fetch("/api/submit-build/photo-uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        buildId,
        files: files.map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size
        }))
      })
    });

    const prepareText = await prepareResponse.text();
    let preparePayload: {
      uploads?: Array<{
        path: string;
        token: string;
        publicUrl: string;
        altText: string;
        sortOrder: number;
      }>;
      error?: string;
      details?: string;
      raw?: string;
    } | null;

    try {
      preparePayload = prepareText ? JSON.parse(prepareText) : null;
    } catch {
      preparePayload = { raw: prepareText };
    }

    if (!prepareResponse.ok || !preparePayload?.uploads) {
      console.error("Build photo upload preparation failed", {
        status: prepareResponse.status,
        statusText: prepareResponse.statusText,
        response: preparePayload
      });
      throw new Error("Build submitted, but file upload setup failed.");
    }

    const supabase = createSupabaseBrowserClient();
    const completedPhotos = [];

    for (const [index, upload] of preparePayload.uploads.entries()) {
      const file = files[index];
      if (!file) continue;

      const { error } = await supabase.storage
        .from(buildPhotosBucket)
        .uploadToSignedUrl(upload.path, upload.token, file);

      if (error) {
        console.error("Build photo upload failed", {
          file: file.name,
          path: upload.path,
          error
        });
        throw new Error("Build submitted, but one or more files could not be uploaded.");
      }

      completedPhotos.push({
        buildId,
        url: upload.publicUrl,
        altText: upload.altText,
        sortOrder: upload.sortOrder
      });
    }

    const completeResponse = await fetch("/api/submit-build/photo-uploads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "complete",
        photos: completedPhotos
      })
    });

    const completeText = await completeResponse.text();
    let completePayload: { error?: string; details?: string; raw?: string } | null;

    try {
      completePayload = completeText ? JSON.parse(completeText) : null;
    } catch {
      completePayload = { raw: completeText };
    }

    if (!completeResponse.ok) {
      console.error("Build photo row insert failed", {
        status: completeResponse.status,
        statusText: completeResponse.statusText,
        response: completePayload
      });
      throw new Error("Build submitted, but the uploaded files could not be attached.");
    }
  }

  function updateRequiredField(field: keyof RequiredState) {
    return (value: string) => setRequiredState((current) => ({ ...current, [field]: value }));
  }

  return (
    <form className="card form" onSubmit={onSubmit} encType="multipart/form-data">
      <FormSection title="Contact Info" copy="Tell us who submitted the build. Public build pages only show your social handle. Contact email is optional and stays private.">
        <div className="grid two">
          <Field name="socialHandle" label="Instagram/social handle" placeholder="@username" value={requiredState.socialHandle} onValueChange={updateRequiredField("socialHandle")} required />
          <Field name="contactEmail" label="Contact email, optional" placeholder="you@example.com" type="email" required={false} />
        </div>
      </FormSection>

      <FormSection title="Vehicle Info">
        <div className="grid two">
          <Select name="year" label="Vehicle year" options={years} value={requiredState.year} onValueChange={updateRequiredField("year")} required />
          <Field name="make" label="Make" value={requiredState.make} onValueChange={updateRequiredField("make")} required />
        </div>
        <div className="grid two">
          <Field name="model" label="Model" value={requiredState.model} onValueChange={updateRequiredField("model")} required />
          <Select name="trim" label="Trim, if known" options={trims} required={false} />
        </div>
        <div className="grid two">
          <Select name="cab" label="Cab, if known" options={cabs} required={false} />
          <Select name="bed" label="Bed length, if known" options={beds} required={false} />
        </div>
      </FormSection>

      <FormSection title="Wheels & Tires">
        <div className="grid two">
          <Field name="tireBrand" label="Tire brand, if known" placeholder="Falken" required={false} />
          <Field name="tireModel" label="Tire model, if known" placeholder="Wildpeak A/T4W" required={false} />
        </div>
        <Field name="tireSize" label="Tire size" placeholder="285/70R17" value={requiredState.tireSize} onValueChange={updateRequiredField("tireSize")} required />
        <div className="grid two">
          <Field name="wheelBrand" label="Wheel brand, if known" placeholder="Method" required={false} />
          <Field name="wheelModel" label="Wheel model, if known" placeholder="316" required={false} />
        </div>
        <div className="grid two">
          <Field name="wheelSize" label="Wheel size" placeholder="17x8.5" value={requiredState.wheelSize} onValueChange={updateRequiredField("wheelSize")} required />
          <Field name="wheelOffset" label="Wheel offset, if known" placeholder="-12" type="number" required={false} />
        </div>
      </FormSection>

      <FormSection title="Suspension & Clearance" copy="Add either the lift height or suspension setup. If you know both, include both.">
        <div className="grid two">
          <Field name="liftHeight" label="Lift height, if known" placeholder="2.5" type="number" step="0.25" value={requiredState.liftHeight} onValueChange={updateRequiredField("liftHeight")} required={false} />
          <Field name="suspensionType" label="Suspension type, if known" placeholder="Level kit" required={false} />
        </div>
        <div className="grid two">
          <Field name="suspensionBrand" label="Suspension brand, if known" placeholder="Fox" required={false} />
          <Field name="suspensionModel" label="Suspension model, if known" placeholder="2.5" required={false} />
        </div>
        <Field name="suspensionSetup" label="Suspension setup/details" placeholder="Coilovers, UCAs, rear leafs, spacers, etc." value={requiredState.suspensionSetup} onValueChange={updateRequiredField("suspensionSetup")} required={false} />
        <Select name="rubbingSeverity" label="How bad is the rubbing?" options={rubbingOptions} value={requiredState.rubbingSeverity} onValueChange={updateRequiredField("rubbingSeverity")} required />
        <div className="grid two">
          <Select name="trimmingRequired" label="Trimming required?" options={yesNoUnknownOptions} value={requiredState.trimmingRequired} onValueChange={updateRequiredField("trimmingRequired")} required />
          <Select name="bodyMountChop" label="Body mount chop done?" options={yesNoUnknownOptions} value={requiredState.bodyMountChop} onValueChange={updateRequiredField("bodyMountChop")} required />
        </div>
        <Select name="fitmentRisk" label="Fitment risk, if known" options={riskOptions} defaultValue="Unknown" required={false} />
        <label className="field">
          <span>Fitment/rubbing notes, optional</span>
          <textarea name="fitmentNotes" placeholder="Describe rubbing, trimming, alignment, wheel spacers, payload, or anything that affects clearance." />
        </label>
      </FormSection>

      <FormSection title="Extra Build Details">
        <Field name="sourceUrl" label="Source URL, optional" placeholder="https://..." type="url" required={false} />
        <label className="field">
          <span>Lighting upgrades, optional</span>
          <textarea name="lightingUpgrades" placeholder="Light bars, pods, ditch lights, fogs, switch panels, wiring, or anything lighting-related." />
        </label>
        <label className="field">
          <span>Favorite mods / recommendations, optional</span>
          <textarea name="favoriteModifications" placeholder="What upgrades do you like most, or what would you recommend to other Tacoma owners?" />
        </label>
        <label className="field">
          <span>Full build list / extra notes, optional</span>
          <textarea name="fullBuildList" placeholder="Already have your setup written out? Paste the full build list here." />
          <small className="fine">Already have your setup written out? Paste the full build list here.</small>
        </label>
      </FormSection>

      <FormSection title="Upload File" copy="Photos, screenshots, and spec sheets are helpful if you have them.">
        <label className="field">
          <span>Photo or file attachment, optional</span>
          <input name="attachment" type="file" accept="image/*,.pdf,.txt,.doc,.docx" multiple />
          <small className="fine">Attach screenshots, notes files, spec sheets, or photos if you have them.</small>
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

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  onValueChange?: (value: string) => void;
}) {
  const { label, required = true, onValueChange, onChange, ...inputProps } = props;
  return (
    <label className="field">
      <span>{label}</span>
      <input
        {...inputProps}
        required={required}
        onChange={(event) => {
          onValueChange?.(event.target.value);
          onChange?.(event);
        }}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  defaultValue,
  value,
  onValueChange,
  required = true
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        required={required}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {options.map((option) => <option key={option || "blank"} value={option}>{option || "Select one"}</option>)}
      </select>
    </label>
  );
}
