// Shared shape for the cached NHTSA vPIC year/make/model reference data.
// The whole cache is a few hundred short strings, so the submit form ships it
// once and cascades in memory instead of querying on every dropdown change.
export type VehicleOptions = {
  years: number[];
  makesByYear: Record<string, string[]>;
  modelsByYearMake: Record<string, string[]>;
};

export const emptyVehicleOptions: VehicleOptions = {
  years: [],
  makesByYear: {},
  modelsByYearMake: {}
};

export function vehicleOptionsKey(year: string | number, make: string) {
  return `${year}|${make}`;
}

export type VehicleModelRow = {
  model_name: string | null;
  model_year: number | null;
  vehicle_makes: { name: string | null } | Array<{ name: string | null }> | null;
};

export function buildVehicleOptions(rows: VehicleModelRow[]): VehicleOptions {
  const years = new Set<number>();
  const makesByYear = new Map<string, Set<string>>();
  const modelsByYearMake = new Map<string, Set<string>>();

  for (const row of rows) {
    const relation = Array.isArray(row.vehicle_makes) ? row.vehicle_makes[0] : row.vehicle_makes;
    const make = relation?.name?.trim();
    const model = row.model_name?.trim();
    const year = row.model_year;

    if (!make || !model || !year) continue;

    years.add(year);

    const yearKey = String(year);
    if (!makesByYear.has(yearKey)) makesByYear.set(yearKey, new Set());
    makesByYear.get(yearKey)!.add(make);

    const modelKey = vehicleOptionsKey(year, make);
    if (!modelsByYearMake.has(modelKey)) modelsByYearMake.set(modelKey, new Set());
    modelsByYearMake.get(modelKey)!.add(model);
  }

  const sortedText = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b));

  return {
    years: Array.from(years).sort((a, b) => b - a),
    makesByYear: Object.fromEntries(Array.from(makesByYear, ([key, value]) => [key, sortedText(value)])),
    modelsByYearMake: Object.fromEntries(Array.from(modelsByYearMake, ([key, value]) => [key, sortedText(value)]))
  };
}
