"use client";

import { useMemo, useState } from "react";
import {
  emptyVehicleOptions,
  fallbackModelsByMake,
  fallbackYearOptions,
  otherVehicleOption,
  vehicleOptionsKey,
  type VehicleOptions
} from "@/lib/vehicleOptions";

export type VehicleSelection = {
  year: string;
  make: string;
  model: string;
};

// Cascading year/make/model selector backed by the cached NHTSA reference
// data, with an "Other" escape hatch at the make and model level. Owns the
// custom-entry state internally and reports resolved values to the parent.
export function VehicleSelect({
  vehicleOptions = emptyVehicleOptions,
  onChange,
  required = true
}: {
  vehicleOptions?: VehicleOptions;
  onChange: (selection: VehicleSelection) => void;
  required?: boolean;
}) {
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [model, setModel] = useState("");
  const [customModel, setCustomModel] = useState("");

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

    return [...available, otherVehicleOption];
  }, [usesReferenceData, vehicleOptions.makesByYear, year]);

  const isCustomMake = make === otherVehicleOption;

  const modelChoices = useMemo(() => {
    if (isCustomMake) return [];

    return usesReferenceData
      ? vehicleOptions.modelsByYearMake[vehicleOptionsKey(year, make)] ?? []
      : fallbackModelsByMake[make] ?? [];
  }, [isCustomMake, usesReferenceData, vehicleOptions.modelsByYearMake, year, make]);

  const isCustomModel = isCustomMake || model === otherVehicleOption;

  function emit(next: {
    year: string;
    make: string;
    customMake: string;
    model: string;
    customModel: string;
  }) {
    const resolvedMake = next.make === otherVehicleOption ? next.customMake.trim() : next.make;
    const customModelSelected = next.make === otherVehicleOption || next.model === otherVehicleOption;
    const resolvedModel = customModelSelected ? next.customModel.trim() : next.model;

    onChange({ year: next.year, make: resolvedMake, model: resolvedModel });
  }

  function onYearChange(value: string) {
    setYear(value);

    // Available makes depend on the year in the reference data, so a year
    // change can leave a previously chosen make with no matching models.
    if (usesReferenceData) {
      setMake("");
      setCustomMake("");
      setModel("");
      setCustomModel("");
      emit({ year: value, make: "", customMake: "", model: "", customModel: "" });
      return;
    }

    emit({ year: value, make, customMake, model, customModel });
  }

  function onMakeChange(value: string) {
    setMake(value);
    setModel("");
    setCustomModel("");
    const nextCustomMake = value === otherVehicleOption ? customMake : "";
    if (value !== otherVehicleOption) setCustomMake("");

    emit({ year, make: value, customMake: nextCustomMake, model: "", customModel: "" });
  }

  function onCustomMakeChange(value: string) {
    setCustomMake(value);
    emit({ year, make, customMake: value, model, customModel });
  }

  function onModelChange(value: string) {
    setModel(value);
    emit({ year, make, customMake, model: value, customModel });
  }

  function onCustomModelChange(value: string) {
    setCustomModel(value);
    emit({ year, make, customMake, model, customModel: value });
  }

  return (
    <>
      <div className="verify-vehicle-grid">
        <label className="field">
          <span>Year</span>
          <select name="year" value={year} onChange={(event) => onYearChange(event.target.value)} required={required}>
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
            required={required}
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
            onChange={(event) => onCustomMakeChange(event.target.value)}
            required={required}
          />
        </label>
      ) : null}

      <label className="field">
        <span>Model</span>
        {isCustomModel ? (
          <input
            placeholder="Enter your model"
            value={customModel}
            onChange={(event) => onCustomModelChange(event.target.value)}
            required={required}
          />
        ) : (
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={!make}
            required={required}
          >
            <option value="">{make ? "Select model" : "Select a make first"}</option>
            {modelChoices.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {make ? <option value={otherVehicleOption}>{otherVehicleOption}</option> : null}
          </select>
        )}
      </label>
    </>
  );
}
