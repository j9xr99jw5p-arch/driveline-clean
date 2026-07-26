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

export function BuildCard({ build, locked = false }: { build: VerifiedBuild; locked?: boolean }) {
  const photo = build.verified_build_photos?.[0];
  const socialHandle = getPublicSocialHandle(build);
  const title = locked ? `${build.year} ${build.make} ${build.model}` : formatBuildTitle(build);

  return (
    <Link className="card build-card" href={locked ? "/check" : `/builds/${build.id}`}>
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
        <h3>{title}</h3>
        {locked ? (
          <>
            <div className="locked-build-labels" aria-label="Locked build details">
              {["Wheel specs", "Tire specs", "Lift", "Rubbing", "Trimming", "Full photo gallery"].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
            <span className="button primary full build-unlock-button">Unlock full build</span>
          </>
        ) : (
          <>
            <span className={`pill ${build.fitment_risk}`}>{build.fitment_risk} risk</span>
            <p className="build-combo">{formatWheelTireCombo(build)}</p>
            <p className="build-suspension">{formatSuspension(build)}</p>
            <div className="build-secondary">
              <p>{formatPrimaryFitmentDetails(build)}</p>
              <p>{formatSecondaryFitmentDetails(build)}</p>
              {socialHandle ? <p>{socialHandle}</p> : null}
            </div>
          </>
        )}
      </div>
    </Link>
  );
}
