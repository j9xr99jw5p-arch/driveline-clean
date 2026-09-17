import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildVehicleOptions,
  emptyVehicleOptions,
  type VehicleModelRow,
  type VehicleOptions
} from "@/lib/vehicleOptions";

// Read with the service role so the form keeps working regardless of the
// public read policies on the reference tables.
export async function getVehicleOptions(): Promise<VehicleOptions> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return emptyVehicleOptions;
  }

  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  const rows: VehicleModelRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("vehicle_models")
      .select("model_name, model_year, vehicle_makes(name)")
      .order("model_year", { ascending: false })
      .order("model_name")
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Failed to load vehicle options", error);
      break;
    }

    if (!data?.length) break;

    rows.push(...(data as VehicleModelRow[]));

    if (data.length < pageSize) break;
  }

  return buildVehicleOptions(rows);
}
