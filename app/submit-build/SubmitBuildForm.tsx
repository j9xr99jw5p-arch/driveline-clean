"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { emptyVehicleOptions, vehicleOptionsKey, type VehicleOptions } from "@/lib/vehicleOptions";

const friendlyErrorMessage =
  "We’re having trouble submitting your build right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

const buildPhotosBucket = process.env.NEXT_PUBLIC_SUPABASE_BUILD_PHOTOS_BUCKET || "verified-build-photos";

const attachmentMessage = "Please add at least one photo of your build.";

const otherOption = "Other";

const earliestYear = 1995;
const latestYear = Math.min(new Date().getFullYear() + 1, 2035);

const fallbackYearOptions = Array.from(
  { length: latestYear - earliestYear + 1 },
  (_, index) => String(latestYear - index)
);

// Used when the vehicle reference cache is empty or unreachable, so the form
// always offers a usable set of options.
const fallbackModelsByMake: Record<string, string[]> = {
  Toyota: ["Tacoma", "Tundra", "4Runner", "Sequoia", "Land Cruiser"],
  Ford: ["F-150", "F-250", "F-350", "Ranger", "Bronco", "Maverick"],
  Chevrolet: ["Silverado 1500", "Silverado 2500HD", "Silverado 3500HD", "Colorado", "Tahoe", "Suburban"],
  GMC: ["Sierra 1500", "Sierra 2500HD", "Sierra 3500HD", "Canyon", "Yukon"],
  Ram: ["1500", "2500", "3500"],
  Jeep: ["Gladiator", "Wrangler", "Grand Cherokee"],
  Nissan: ["Frontier", "Titan", "Titan XD", "Xterra"]
};

export function SubmitBuildForm({ vehicleOptions = emptyVehicleOptions }: { vehicleOptions?: VehicleOptions }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [wheelSetup, setWheelSetup] = useState("");
  const [tireSetup, setTireSetup] = useState("");
  const [suspensionSetup, setSuspensionSetup] = useState("");
  const [description, setDescription] = useState("");
  const [fitmentNotes, setFitmentNotes] = useState("");
  const [favoriteModification, setFavoriteModification] = useState("");

  const usesReferenceData = vehicleOptions.years.length > 0;

  const yearOptions = useMemo(
    () => (usesReferenceData ? vehicleOptions.years.map(String) : fallbackYearOptions),
    [usesReferenceData, vehicleOptions.years]
  );

  const makeOptions = useMemo(() => {
    const available = usesReferenceData
      ? year
        ? vehicleOptions.makesByYear[year] ?? []
        : []
      : Object.keys(fallbackModelsByMake);

    return [...available, otherOption];
  }, [usesReferenceData, vehicleOptions.makesByYear, year]);

  const isCustomMake = make === otherOption;

  const modelChoices = useMemo(() => {
    if (isCustomMake) return [];

    return usesReferenceData
      ? vehicleOptions.modelsByYearMake[vehicleOptionsKey(year, make)] ?? []
      : fallbackModelsByMake[make] ?? [];
  }, [isCustomMake, usesReferenceData, vehicleOptions.modelsByYearMake, year, make]);

  const isCustomModel = isCustomMake || model === otherOption;

  const resolvedMake = isCustomMake ? customMake.trim() : make;
  const resolvedModel = isCustomModel ? customModel.trim() : model;

  const canSubmit = useMemo(() => {
    return Boolean(
      year &&
      resolvedMake &&
      resolvedModel &&
      wheelSetup.trim() &&
      tireSetup.trim() &&
      suspensionSetup.trim() &&
      fitmentNotes.trim()
    );
  }, [year, resolvedMake, resolvedModel, wheelSetup, tireSetup, suspensionSetup, fitmentNotes]);

  function onYearChange(value: string) {
    setYear(value);

    // Available makes depend on the year in the reference data, so a year
    // change can leave a previously chosen make with no matching models.
    if (usesReferenceData) {
      setMake("");
      setCustomMake("");
      setModel("");
      setCustomModel("");
    }
  }

  function onMakeChange(value: string) {
    setMake(value);
    setModel("");
    setCustomModel("");
    if (value !== otherOption) setCustomMake("");
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!canSubmit) {
      setStatus("Please choose your year, make, and model, then fill in your wheel, tire, and suspension setup and how you made it fit.");
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
      submitData.set("hasAttachment", files.length > 0 ? "yes" : "");
      submitData.set("make", resolvedMake);
      submitData.set("model", resolvedModel);

      if (files.length === 0) {
        setStatus(attachmentMessage);
        return;
      }

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
        throw new Error(payload?.error || payload?.message || (response.status >= 500 ? friendlyErrorMessage : "Build submission failed"));
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

  return (
    <form className="verify-form" onSubmit={onSubmit} encType="multipart/form-data">
      <div className="verify-vehicle-grid">
        <label className="field">
          <span>Year</span>
          <select name="year" value={year} onChange={(event) => onYearChange(event.target.value)} required>
            <option value="">Select year</option>
            {yearOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Make</span>
          <select
            value={make}
            onChange={(event) => onMakeChange(event.target.value)}
            disabled={usesReferenceData && !year}
            required
          >
            <option value="">{usesReferenceData && !year ? "Select a year first" : "Select make"}</option>
            {makeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isCustomMake ? (
        <label className="field">
          <span>Make name</span>
          <input
            placeholder="Enter your make"
            value={customMake}
            onChange={(event) => setCustomMake(event.target.value)}
            required
          />
        </label>
      ) : null}

      <label className="field">
        <span>Model</span>
        {isCustomModel ? (
          <input
            placeholder="Enter your model"
            value={customModel}
            onChange={(event) => setCustomModel(event.target.value)}
            required
          />
        ) : (
          <select value={model} onChange={(event) => setModel(event.target.value)} disabled={!make} required>
            <option value="">{make ? "Select model" : "Select a make first"}</option>
            {modelChoices.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {make ? <option value={otherOption}>{otherOption}</option> : null}
          </select>
        )}
      </label>

      <label className="field">
        <span>Wheel setup</span>
        <textarea
          name="wheelSetup"
          className="verify-spec"
          placeholder="Brand, model, size, offset or backspacing. Example: RRW RR7-H, 17x8.5, -10 offset."
          value={wheelSetup}
          onChange={(event) => setWheelSetup(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Tire setup</span>
        <textarea
          name="tireSetup"
          className="verify-spec"
          placeholder="Brand, model, and size. Example: BFGoodrich KO2, 285/70R17."
          value={tireSetup}
          onChange={(event) => setTireSetup(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Suspension setup</span>
        <textarea
          name="suspensionSetup"
          className="verify-spec"
          placeholder="Lift or leveling height, brand, and components. Example: 3 in Bilstein 6112 front, 5100 rear with add-a-leaf."
          value={suspensionSetup}
          onChange={(event) => setSuspensionSetup(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Tell us more about your build</span>
        <textarea
          name="buildDescription"
          className="verify-description"
          placeholder="Any other modifications: bumpers, armor, lighting, wheel spacers, gearing, or anything else worth knowing."
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <label className="field">
        <span>How did you make it fit?</span>
        <textarea
          name="fitmentNotes"
          className="verify-note"
          placeholder="Any trimming, cutting, body mount chop, crash bar removal, or other custom work. If it bolted on with no modifications, just say so."
          value={fitmentNotes}
          onChange={(event) => setFitmentNotes(event.target.value)}
          required
        />
      </label>

      <label className="field">
        <span>Favorite modification</span>
        <textarea
          name="favoriteModifications"
          className="verify-note"
          placeholder="The one change that made the biggest difference in looks, ride quality, or capability, and why."
          value={favoriteModification}
          onChange={(event) => setFavoriteModification(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Photos</span>
        <input name="attachment" type="file" accept="image/*" multiple required />
        <small className="fine">At least one photo of your truck is required for verification.</small>
      </label>

      <div className="verify-contact">
        <div className="verify-contact-grid">
          <label className="field">
            <span>Social handle</span>
            <input name="socialHandle" placeholder="@username" />
          </label>
          <label className="field">
            <span>Email</span>
            <input name="contactEmail" type="email" placeholder="you@example.com" />
          </label>
        </div>
        <p className="fine">Optional. Your handle is used to credit the build, and your email stays private.</p>
      </div>

      <button className="button verify-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Get My Build Verified"}
      </button>
      {status ? <p className="form-error">{status}</p> : null}
    </form>
  );
}
