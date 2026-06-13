import Link from "next/link";
import {
  formatBuildTitle,
  formatPrimaryFitmentDetails,
  formatSecondaryFitmentDetails,
  formatSuspension,
  formatWheelTireCombo
} from "@/lib/buildDisplay";
import type { VerifiedBuild } from "@/lib/types";

export function BuildCard({ build }: { build: VerifiedBuild }) {
  const photo = build.verified_build_photos?.[0];

  return (
    <Link className="card build-card" href={`/builds/${build.id}`}>
      <div className="build-media">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={photo.alt_text ?? "Verified Tacoma build"} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : <span>No photo yet</span>}
      </div>
      <div className="build-body">
        <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
        <h3>{formatBuildTitle(build)}</h3>
        <p className="build-combo">{formatWheelTireCombo(build)}</p>
        <p className="build-suspension">{formatSuspension(build)}</p>
        <div className="build-secondary">
          <p>{formatPrimaryFitmentDetails(build)}</p>
          <p>{formatSecondaryFitmentDetails(build)}</p>
          {build.owner_name || build.source_url ? <p>{build.owner_name ?? build.source_url}</p> : null}
        </div>
      </div>
    </Link>
  );
}
