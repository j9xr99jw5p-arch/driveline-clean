import type { VerifiedBuild } from "@/lib/types";

export const premiumBuildListSelect = "*, verified_build_photos(*)";
export const previewBuildListSelect =
  "id, year, make, model, trim, cab, bed, tire_size, wheel_size, lift_height, fitment_risk, published, verified_build_photos(id, build_id, url, alt_text, sort_order)";
export const previewBuildDetailSelect =
  "id, year, make, model, trim, tire_size, wheel_size, lift_height, fitment_risk, published";

export const restrictedVerifiedBuildFields = [
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
    trim: build.trim ?? null,
    cab: build.cab ?? null,
    bed: build.bed ?? null,
    tire_size: build.tire_size,
    wheel_size: build.wheel_size ?? null,
    lift_height: build.lift_height ?? null,
    fitment_risk: build.fitment_risk,
    published: build.published,
    verified_build_photos: build.verified_build_photos
  };
}

export function previewSelectIsSanitized() {
  return restrictedVerifiedBuildFields.every((field) => !previewBuildListSelect.includes(field) && !previewBuildDetailSelect.includes(field));
}
