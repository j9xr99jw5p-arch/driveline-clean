"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clearTruckProfile, loadFitmentResult, loadTruckProfile } from "@/lib/reportRenderer";
import type { FitmentInput, GarageVehicle, StoredFitmentResult } from "@/lib/types";

export default function GaragePage() {
  const [profile, setProfile] = useState<FitmentInput | null>(null);
  const [result, setResult] = useState<StoredFitmentResult | null>(null);
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [garageStatus, setGarageStatus] = useState<string | null>(null);

  useEffect(() => {
    setProfile(loadTruckProfile());
    setResult(loadFitmentResult());

    async function loadVehicles() {
      try {
        const response = await fetch("/api/garage/vehicles");
        const payload = await response.json();

        if (response.ok) {
          setVehicles(payload.vehicles ?? []);
          setGarageStatus(null);
        } else if (response.status === 401) {
          setGarageStatus("Sign in to sync garage vehicles across devices.");
        } else {
          setGarageStatus("We couldn’t load this information right now. Please try again shortly.");
        }
      } catch (error) {
        console.error("Could not load garage vehicles", error);
        setGarageStatus("We couldn’t load this information right now. Please try again shortly.");
      }
    }

    loadVehicles();
  }, []);

  function onClearProfile() {
    clearTruckProfile();
    setProfile(null);
  }

  return (
    <section className="band">
      <div className="section">
        <div className="page-head">
          <p className="eyebrow">Garage</p>
          <h1>Your Tacoma garage.</h1>
          <p className="lead">Sign in to save garage vehicles across devices. This device can still show your latest fitment profile.</p>
        </div>

        {garageStatus ? <p className="muted" style={{ marginBottom: 20 }}>{garageStatus}</p> : null}

        {vehicles.length ? (
          <div className="section-stack">
            {vehicles.map((vehicle) => {
              const latestConfiguration = vehicle.configurations[0];

              return (
                <div className="card" key={vehicle.id}>
                  <div className="grid two">
                    <div>
                      <h2>{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</h2>
                      <div className="detail-grid">
                        <ProfileField label="Cab / Bed" value={`${vehicle.cab} / ${vehicle.bed}`} />
                        <ProfileField label="Current Tires" value={vehicle.currentTireSize ?? "Not entered"} />
                        <ProfileField label="Saved Configurations" value={vehicle.configurations.length} />
                      </div>
                    </div>
                    <div>
                      <h2>Latest Configuration</h2>
                      {latestConfiguration ? (
                        <div className="detail-grid">
                          <ProfileField label="Tire" value={latestConfiguration.tireSize} />
                          <ProfileField label="Wheel" value={`${latestConfiguration.wheelDiameter}x${latestConfiguration.wheelWidth}, ${latestConfiguration.wheelOffset}mm offset`} />
                          <ProfileField label="Lift" value={`${latestConfiguration.liftHeight} in`} />
                          <ProfileField label="Use Case" value={latestConfiguration.useCase} />
                        </div>
                      ) : (
                        <p className="muted">No configurations saved yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : profile ? (
          <div className="grid two">
            <div className="card">
              <h2>Local Truck Profile</h2>
              <div className="detail-grid">
                <ProfileField label="Vehicle" value={`${profile.year} Toyota Tacoma ${profile.trim}`} />
                <ProfileField label="Cab / Bed" value={`${profile.cab} / ${profile.bed}`} />
                <ProfileField label="Current Tires" value={profile.currentTireSize ?? "Not entered"} />
                <ProfileField label="Intended Tires" value={profile.tireSize} />
                <ProfileField label="Wheel" value={`${profile.wheelDiameter}x${profile.wheelWidth}, ${profile.wheelOffset}mm offset`} />
                <ProfileField label="Lift" value={`${profile.liftHeight} in`} />
                <ProfileField label="Rear Weight" value={profile.rearLoad} />
                <ProfileField label="Use Case" value={profile.useCase} />
              </div>
            </div>

            <div className="card">
              <h2>Latest Result</h2>
              {result ? (
                <>
                  <span className={`pill ${result.report.rubbingRisk}`}>{result.report.rubbingRisk} risk</span>
                  <h3 style={{ marginTop: 16 }}>{result.report.verdict}</h3>
                  <p className="muted">{result.report.explanation}</p>
                </>
              ) : (
                <p className="muted">No fitment result saved yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ maxWidth: 760 }}>
            <h2>No saved profile yet.</h2>
            <p className="muted">Run a fitment check and your truck profile will appear here automatically.</p>
          </div>
        )}

        <div className="actions" style={{ justifyContent: "flex-start", marginTop: 28 }}>
          <Link className="button primary" href="/check">Start fitment check</Link>
          <Link className="button" href="/results">View last results</Link>
          <button className="button" type="button" onClick={onClearProfile}>Clear local profile</button>
        </div>
      </div>
    </section>
  );
}

function ProfileField({ label, value }: { label: string; value: string | number }) {
  return <div className="detail-field"><span>{label}</span><strong>{value}</strong></div>;
}
