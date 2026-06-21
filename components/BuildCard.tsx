import Link from "next/link";
import {
  formatBuildTitle,
  formatPrimaryFitmentDetails,
  formatSecondaryFitmentDetails,
  formatSuspension,
  formatWheelTireCombo
} from "@/lib/buildDisplay";
import { getPublicSocialHandle } from "@/lib/buildPrivacy";
import type { VerifiedBuild } from "@/lib/types";

export function BuildCard({ build }: { build: VerifiedBuild }) {
  const photo = build.verified_build_photos?.[0];
  const socialHandle = getPublicSocialHandle(build);
  const title = formatBuildTitle(build);

  return (
    <Link className="card build-card" href={`/builds/${build.id}`}>
      <div className="build-card-image-frame">
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="build-card-image-bg" src={photo.url} alt="" aria-hidden="true" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="build-card-image-main" src={photo.url} alt={photo.alt_text ?? title} />
          </>
        ) : <span>No photo yet</span>}
      </div>
      <div className="build-body">
        <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
        <h3>{title}</h3>
        <p className="build-combo">{formatWheelTireCombo(build)}</p>
        <p className="build-suspension">{formatSuspension(build)}</p>
        <div className="build-secondary">
          <p>{formatPrimaryFitmentDetails(build)}</p>
          <p>{formatSecondaryFitmentDetails(build)}</p>
          {socialHandle ? <p>{socialHandle}</p> : null}
        </div>
      </div>
    </Link>
  );
}
