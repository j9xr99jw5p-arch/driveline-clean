import type { VerifiedBuild } from "@/lib/types";

export const premiumBuildListSelect = "*, verified_build_photos(*)";
export const previewBuildListSelect =
  "id, year, make, model, primary_photo_url, primary_photo_alt_text";
export const previewBuildDetailSelect =
  "id, year, make, model, primary_photo_url, primary_photo_alt_text";

export type VerifiedBuildPreview = {
  id: string;
  year: number;
  make: string;
  model: string;
  primary_photo_url: string | null;
  primary_photo_alt_text: string | null;
};

export const restrictedVerifiedBuildFields = [
  "trim",
  "cab",
  "bed",
  "tire_size",
  "tire_brand",
  "tire_model",
  "wheel_size",
  "wheel_brand",
  "wheel_model",
  "wheel_width",
  "wheel_diameter",
  "wheel_offset",
  "lift_height",
  "fitment_risk",
  "notes",
  "source_url",
  "owner_name",
  "rubbing_severity",
  "trimming_required",
  "body_mount_chop",
  "suspension_setup",
  "suspension_brand",
  "suspension_model",
  "suspension_type",
  "lighting_upgrades",
  "favorite_modifications",
  "build_summary"
];

export function sanitizeVerifiedBuildPreview(build: Partial<VerifiedBuild>): Partial<VerifiedBuild> {
  return {
    id: build.id,
    year: build.year,
    make: build.make,
    model: build.model,
    verified_build_photos: build.verified_build_photos?.slice(0, 1)
  };
}

export function mapVerifiedBuildPreview(build: VerifiedBuildPreview): Partial<VerifiedBuild> {
  return {
    id: build.id,
    year: build.year,
    make: build.make,
    model: build.model,
    verified_build_photos: build.primary_photo_url
      ? [{
        id: `${build.id}-primary-photo`,
        build_id: build.id,
        url: build.primary_photo_url,
        alt_text: build.primary_photo_alt_text,
        sort_order: 0
      }]
      : []
  };
}

export function previewSelectIsSanitized() {
  return restrictedVerifiedBuildFields.every((field) => !previewBuildListSelect.includes(field) && !previewBuildDetailSelect.includes(field));
}
