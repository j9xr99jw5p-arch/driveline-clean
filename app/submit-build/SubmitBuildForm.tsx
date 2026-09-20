"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VehicleSelect, type VehicleSelection } from "@/components/VehicleSelect";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { emptyVehicleOptions, type VehicleOptions } from "@/lib/vehicleOptions";

const friendlyErrorMessage =
  "We’re having trouble submitting your build right now. We’re working to fix it as quickly as possible. Please try again in a moment.";

const buildPhotosBucket = process.env.NEXT_PUBLIC_SUPABASE_BUILD_PHOTOS_BUCKET || "verified-build-photos";

const attachmentMessage = "Please add at least one photo of your build.";

export function SubmitBuildForm({
  vehicleOptions = emptyVehicleOptions,
  initialVehicle
}: {
  vehicleOptions?: VehicleOptions;
  initialVehicle?: VehicleSelection;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleSelection>(initialVehicle ?? { year: "", make: "", model: "" });
  const [wheelSetup, setWheelSetup] = useState("");
  const [tireSetup, setTireSetup] = useState("");
  const [suspensionSetup, setSuspensionSetup] = useState("");
  const [description, setDescription] = useState("");
  const [fitmentNotes, setFitmentNotes] = useState("");
  const [favoriteModification, setFavoriteModification] = useState("");

  const canSubmit = useMemo(() => {
    return Boolean(
      vehicle.year &&
      vehicle.make &&
      vehicle.model &&
      wheelSetup.trim() &&
      tireSetup.trim() &&
      suspensionSetup.trim() &&
      fitmentNotes.trim()
    );
  }, [vehicle, wheelSetup, tireSetup, suspensionSetup, fitmentNotes]);

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
      submitData.set("year", vehicle.year);
      submitData.set("make", vehicle.make);
      submitData.set("model", vehicle.model);

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
      <VehicleSelect vehicleOptions={vehicleOptions} initial={initialVehicle} onChange={setVehicle} />

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
