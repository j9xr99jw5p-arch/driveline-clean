import { NextResponse } from "next/server";
import { z } from "zod";
import { loadVehicleConfigurations } from "@/lib/garage";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  tireSize: z.string().min(5),
  wheelDiameter: z.coerce.number().min(14).max(24),
  wheelWidth: z.coerce.number().min(6).max(14),
  wheelOffset: z.coerce.number().min(-80).max(80),
  liftHeight: z.coerce.number().min(0).max(10),
  useCase: z.string().min(1),
  rearLoad: z.string().min(1),
  buildGoals: z.string().optional()
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);

  if (!currentUser) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const configurations = await loadVehicleConfigurations(supabase, currentUser.userId, id);
    return NextResponse.json({ configurations });
  } catch {
    return NextResponse.json({ error: "Could not load vehicle configurations." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid vehicle configuration." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);

  if (!currentUser) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", id)
    .eq("user_id", currentUser.userId)
    .maybeSingle();

  if (vehicleError) return NextResponse.json({ error: "Could not verify vehicle ownership." }, { status: 500 });
  if (!vehicle) return NextResponse.json({ error: "Vehicle not found." }, { status: 404 });

  const { data: configuration, error } = await supabase
    .from("vehicle_configurations")
    .insert({
      vehicle_id: id,
      tire_size: parsed.data.tireSize,
      wheel_diameter: parsed.data.wheelDiameter,
      wheel_width: parsed.data.wheelWidth,
      wheel_offset: parsed.data.wheelOffset,
      lift_height: parsed.data.liftHeight,
      use_case: parsed.data.useCase,
      rear_load: parsed.data.rearLoad,
      build_goals: parsed.data.buildGoals?.trim() || null
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Could not save vehicle configuration." }, { status: 500 });

  return NextResponse.json({ configuration });
}
