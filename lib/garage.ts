import type { SupabaseClient } from "@supabase/supabase-js";
import type { FitmentInput, GarageVehicle, VehicleConfiguration } from "./types";

type VehicleRow = {
  id: string;
  user_id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  cab: string;
  bed: string;
  current_tire_size: string | null;
  created_at?: string;
  updated_at?: string;
  vehicle_configurations?: VehicleConfigurationRow[] | null;
};

type VehicleConfigurationRow = {
  id: string;
  vehicle_id: string;
  tire_size: string;
  wheel_diameter: number;
  wheel_width: number;
  wheel_offset: number;
  lift_height: number;
  use_case: string;
  rear_load: string;
  build_goals: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function loadGarageVehicles(supabase: SupabaseClient, userId: string): Promise<GarageVehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select(`
      id,
      user_id,
      year,
      make,
      model,
      trim,
      cab,
      bed,
      current_tire_size,
      created_at,
      updated_at,
      vehicle_configurations (
        id,
        vehicle_id,
        tire_size,
        wheel_diameter,
        wheel_width,
        wheel_offset,
        lift_height,
        use_case,
        rear_load,
        build_goals,
        created_at,
        updated_at
      )
    `)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as VehicleRow[]).map(mapVehicleRow);
}

export async function saveGarageVehicleConfiguration(
  supabase: SupabaseClient,
  userId: string,
  input: FitmentInput
): Promise<GarageVehicle> {
  const vehicleMatch = {
    user_id: userId,
    year: input.year,
    make: "Toyota",
    model: "Tacoma",
    trim: input.trim,
    cab: input.cab,
    bed: input.bed
  };

  const { data: existingVehicle, error: lookupError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("user_id", userId)
    .eq("year", input.year)
    .eq("make", "Toyota")
    .eq("model", "Tacoma")
    .eq("trim", input.trim)
    .eq("cab", input.cab)
    .eq("bed", input.bed)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const currentTireSize = input.currentTireSize?.trim() || null;
  const vehicleResult = existingVehicle?.id
    ? await supabase
        .from("vehicles")
        .update({ current_tire_size: currentTireSize })
        .eq("id", existingVehicle.id)
        .eq("user_id", userId)
        .select("id, user_id, year, make, model, trim, cab, bed, current_tire_size, created_at, updated_at")
        .single()
    : await supabase
        .from("vehicles")
        .insert({ ...vehicleMatch, current_tire_size: currentTireSize })
        .select("id, user_id, year, make, model, trim, cab, bed, current_tire_size, created_at, updated_at")
        .single();

  if (vehicleResult.error) throw vehicleResult.error;

  const vehicle = vehicleResult.data as VehicleRow;
  const { data: configuration, error: configurationError } = await supabase
    .from("vehicle_configurations")
    .insert({
      vehicle_id: vehicle.id,
      tire_size: input.tireSize,
      wheel_diameter: input.wheelDiameter,
      wheel_width: input.wheelWidth,
      wheel_offset: input.wheelOffset,
      lift_height: input.liftHeight,
      use_case: input.useCase,
      rear_load: input.rearLoad,
      build_goals: input.buildGoals?.trim() || null
    })
    .select(`
      id,
      vehicle_id,
      tire_size,
      wheel_diameter,
      wheel_width,
      wheel_offset,
      lift_height,
      use_case,
      rear_load,
      build_goals,
      created_at,
      updated_at
    `)
    .single();

  if (configurationError) throw configurationError;

  return mapVehicleRow({
    ...vehicle,
    vehicle_configurations: [configuration as VehicleConfigurationRow]
  });
}

export async function loadVehicleConfigurations(
  supabase: SupabaseClient,
  userId: string,
  vehicleId: string
): Promise<VehicleConfiguration[]> {
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .maybeSingle();

  if (vehicleError) throw vehicleError;
  if (!vehicle) return [];

  const { data, error } = await supabase
    .from("vehicle_configurations")
    .select(`
      id,
      vehicle_id,
      tire_size,
      wheel_diameter,
      wheel_width,
      wheel_offset,
      lift_height,
      use_case,
      rear_load,
      build_goals,
      created_at,
      updated_at
    `)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as VehicleConfigurationRow[]).map(mapConfigurationRow);
}

function mapVehicleRow(row: VehicleRow): GarageVehicle {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    cab: row.cab,
    bed: row.bed,
    currentTireSize: row.current_tire_size,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    configurations: (row.vehicle_configurations ?? []).map(mapConfigurationRow)
  };
}

function mapConfigurationRow(row: VehicleConfigurationRow): VehicleConfiguration {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    tireSize: row.tire_size,
    wheelDiameter: Number(row.wheel_diameter),
    wheelWidth: Number(row.wheel_width),
    wheelOffset: Number(row.wheel_offset),
    liftHeight: Number(row.lift_height),
    useCase: row.use_case,
    rearLoad: row.rear_load,
    buildGoals: row.build_goals,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
