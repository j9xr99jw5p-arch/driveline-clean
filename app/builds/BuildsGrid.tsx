"use client";

import { useMemo, useState } from "react";
import { BuildCard } from "@/components/BuildCard";
import type { VerifiedBuild } from "@/lib/types";

type FilterState = {
  risk: string;
  tire: string;
  lift: string;
  rubbing: string;
};

const defaultFilters: FilterState = {
  risk: "all",
  tire: "all",
  lift: "all",
  rubbing: "all"
};

export function BuildsGrid({ builds }: { builds: VerifiedBuild[] }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const options = useMemo(() => ({
    tires: unique(builds.map((build) => build.tire_size)),
    lifts: unique(builds.map((build) => formatLift(build.lift_height)).filter(Boolean)),
    rubbing: unique(builds.map((build) => build.rubbing_severity).filter(Boolean))
  }), [builds]);

  const filteredBuilds = useMemo(() => builds.filter((build) => {
    const lift = formatLift(build.lift_height);
    return (
      (filters.risk === "all" || build.fitment_risk === filters.risk) &&
      (filters.tire === "all" || build.tire_size === filters.tire) &&
      (filters.lift === "all" || lift === filters.lift) &&
      (filters.rubbing === "all" || build.rubbing_severity === filters.rubbing)
    );
  }), [builds, filters]);

  return (
    <div className="section-stack">
      <div className="card filter-panel">
        <div>
          <p className="eyebrow">Filter Builds</p>
          <h2>Find a setup close to yours.</h2>
        </div>
        <div className="filter-grid">
          <FilterSelect label="Fitment difficulty" value={filters.risk} onChange={(risk) => setFilters((current) => ({ ...current, risk }))} options={[
            { value: "all", label: "All risks" },
            { value: "low", label: "Low risk" },
            { value: "medium", label: "Medium risk" },
            { value: "high", label: "High risk" }
          ]} />
          <FilterSelect label="Tire size" value={filters.tire} onChange={(tire) => setFilters((current) => ({ ...current, tire }))} options={[
            { value: "all", label: "All tires" },
            ...options.tires.map((tire) => ({ value: tire, label: tire }))
          ]} />
          <FilterSelect label="Lift height" value={filters.lift} onChange={(lift) => setFilters((current) => ({ ...current, lift }))} options={[
            { value: "all", label: "All lifts" },
            ...options.lifts.map((lift) => ({ value: lift, label: lift }))
          ]} />
          <FilterSelect label="Rubbing" value={filters.rubbing} onChange={(rubbing) => setFilters((current) => ({ ...current, rubbing }))} options={[
            { value: "all", label: "All outcomes" },
            ...options.rubbing.map((rubbing) => ({ value: rubbing, label: rubbing }))
          ]} />
        </div>
        <div className="filter-actions">
          <span className="muted">{filteredBuilds.length} of {builds.length} builds shown</span>
          <button className="button" type="button" onClick={() => setFilters(defaultFilters)}>Reset</button>
        </div>
      </div>

      {filteredBuilds.length ? (
        <div className="grid three">
          {filteredBuilds.map((build) => <BuildCard key={build.id} build={build} />)}
        </div>
      ) : (
        <div className="card">
          <h2>No matching builds.</h2>
          <p className="muted">Clear the filters or submit a verified setup for review.</p>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function formatLift(liftHeight: number | null) {
  return liftHeight !== null && liftHeight !== undefined ? `${liftHeight} in` : null;
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b));
}
