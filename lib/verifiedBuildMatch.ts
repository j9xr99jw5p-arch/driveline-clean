import {
  formatBooleanLabel,
  formatBuildTitle,
  formatRubbingLabel,
  formatSuspension,
  formatWheelTireCombo
} from "@/lib/buildDisplay";
import { sanitizePublicBuildNotes } from "@/lib/buildPrivacy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FitmentInput, FitmentRisk, MatchedVerifiedBuild, VerifiedBuild } from "@/lib/types";

type VerifiedBuildRow = VerifiedBuild & {
  verified_build_photos?: Array<{ url: string; alt_text: string | null; sort_order?: number }>;
};

export async function findMatchingVerifiedBuilds(input: FitmentInput): Promise<{
  status: string;
  builds: MatchedVerifiedBuild[];
}> {
  try {
    const supabase = createSupabaseAdminClient();
    const closeMatches = await loadCloseMatches(supabase, input);
    const related = closeMatches.length >= 3
      ? []
      : await loadRelatedTruckBuilds(supabase, input, closeMatches.map((build) => build.id));
    const rawBuilds = [...closeMatches, ...related].slice(0, 3);
    const photos = await loadBuildPhotos(supabase, rawBuilds.map((build) => build.id));
    const builds = rawBuilds.map((build) => toMatchedBuild(build, closeMatches.some((match) => match.id === build.id), photos.get(build.id)));

    if (closeMatches.length) {
      return {
        status: closeMatches.length === 1
          ? "1 verified build is close to this setup."
          : `${closeMatches.length} verified builds are close to this setup.`,
        builds
      };
    }

    if (related.length) {
      const truck = [input.year, input.make, input.model].filter(Boolean).join(" ");
      return {
        status: `No close spec match yet. Here are other verified ${truck} builds.`,
        builds
      };
    }

    return {
      status: "No verified builds for this truck yet. The report still uses the clearance rules and your written setup.",
      builds: []
    };
  } catch (error) {
    console.error("Verified build match lookup crashed", error);
    return {
      status: "Verified-build match status could not be checked right now.",
      builds: []
    };
  }
}

async function loadCloseMatches(supabase: ReturnType<typeof createSupabaseAdminClient>, input: FitmentInput) {
  const minOffset = input.wheelOffset - 12;
  const maxOffset = input.wheelOffset + 12;
  const minWidth = input.wheelWidth - 0.5;
  const maxWidth = input.wheelWidth + 0.5;
  const minLift = Math.max(0, input.liftHeight - 0.75);
  const maxLift = input.liftHeight + 0.75;

  let query = supabase
    .from("verified_builds")
    .select(matchSelect)
    .eq("published", true)
    .eq("year", input.year)
    .eq("tire_size", input.tireSize)
    .gte("wheel_offset", minOffset)
    .lte("wheel_offset", maxOffset)
    .gte("wheel_width", minWidth)
    .lte("wheel_width", maxWidth)
    .gte("lift_height", minLift)
    .lte("lift_height", maxLift)
    .limit(3);

  if (input.make) query = query.ilike("make", input.make);
  if (input.model) query = query.ilike("model", input.model);

  const { data, error } = await query;
  if (error) {
    console.error("Close verified-build match lookup failed", error);
    return [];
  }

  return (data ?? []) as VerifiedBuildRow[];
}

async function loadRelatedTruckBuilds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: FitmentInput,
  excludeIds: string[]
) {
  if (!input.make || !input.model) return [];

  let query = supabase
    .from("verified_builds")
    .select(matchSelect)
    .eq("published", true)
    .eq("year", input.year)
    .ilike("make", input.make)
    .ilike("model", input.model)
    .limit(6);

  if (excludeIds.length) query = query.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await query;
  if (error) {
    console.error("Related verified-build lookup failed", error);
    return [];
  }

  return ((data ?? []) as VerifiedBuildRow[]).slice(0, 3);
}

function toMatchedBuild(
  build: VerifiedBuildRow,
  closeMatch: boolean,
  previewPhoto?: { url: string | null; alt: string | null }
): MatchedVerifiedBuild {
  const nestedPhoto = [...(build.verified_build_photos ?? [])]
    .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))[0];
  const notes = sanitizePublicBuildNotes(build.notes);
  const photoUrl = nestedPhoto?.url ?? previewPhoto?.url ?? null;

  return {
    id: build.id,
    title: formatBuildTitle(build),
    photoUrl,
    photoAlt: nestedPhoto?.alt_text ?? previewPhoto?.alt ?? formatBuildTitle(build),
    tireSize: build.tire_size,
    wheel: formatWheelTireCombo(build),
    lift: formatSuspension(build),
    rubbing: formatRubbingLabel(build.rubbing_severity),
    trimming: formatBooleanLabel(build.trimming_required),
    bodyMountChop: formatBooleanLabel(build.body_mount_chop),
    risk: (build.fitment_risk as FitmentRisk | null) ?? null,
    notes: notes ? notes.split(/(?<=[.!?])\s+/)[0] ?? notes : null,
    closeMatch
  };
}

async function loadBuildPhotos(supabase: ReturnType<typeof createSupabaseAdminClient>, ids: string[]) {
  const photos = new Map<string, { url: string | null; alt: string | null }>();
  if (!ids.length) return photos;

  const [{ data: nestedPhotos, error: nestedError }, { data: previews, error: previewError }] = await Promise.all([
    supabase
      .from("verified_build_photos")
      .select("build_id, url, alt_text, sort_order")
      .in("build_id", ids)
      .order("sort_order", { ascending: true }),
    supabase
      .from("verified_build_previews")
      .select("id, primary_photo_url, primary_photo_alt_text")
      .in("id", ids)
  ]);

  if (nestedError) console.error("Verified-build photo lookup failed", nestedError);
  if (previewError) console.error("Verified-build preview photo lookup failed", previewError);

  for (const row of nestedPhotos ?? []) {
    if (photos.has(row.build_id)) continue;
    photos.set(row.build_id, { url: row.url ?? null, alt: row.alt_text ?? null });
  }

  for (const row of previews ?? []) {
    if (photos.get(row.id)?.url) continue;
    photos.set(row.id, {
      url: row.primary_photo_url ?? null,
      alt: row.primary_photo_alt_text ?? null
    });
  }

  return photos;
}

const matchSelect = [
  "id",
  "year",
  "make",
  "model",
  "trim",
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
  "suspension_setup",
  "suspension_brand",
  "suspension_model",
  "suspension_type",
  "rubbing_severity",
  "trimming_required",
  "body_mount_chop",
  "fitment_risk",
  "notes",
  "verified_build_photos(url, alt_text, sort_order)"
].join(", ");
