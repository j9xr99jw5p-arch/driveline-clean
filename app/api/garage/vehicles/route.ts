import { NextResponse } from "next/server";
import { z } from "zod";
import { loadGarageVehicles, saveGarageVehicleConfiguration } from "@/lib/garage";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  year: z.coerce.number().int().min(1995).max(2035),
  trim: z.string().min(1),
  cab: z.string().min(1),
  bed: z.string().min(1),
  currentTireSize: z.string().optional(),
  tireSize: z.string().min(5),
  wheelDiameter: z.coerce.number().min(14).max(24),
  wheelWidth: z.coerce.number().min(6).max(14),
  wheelOffset: z.coerce.number().min(-80).max(80),
  liftHeight: z.coerce.number().min(0).max(10),
  useCase: z.string().min(1),
  rearLoad: z.string().min(1),
  buildGoals: z.string().optional()
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);

  if (!currentUser) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const vehicles = await loadGarageVehicles(supabase, currentUser.userId);
    return NextResponse.json({ vehicles });
  } catch {
    return NextResponse.json({ error: "Could not load garage vehicles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid garage vehicle." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(supabase);

  if (!currentUser) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const vehicle = await saveGarageVehicleConfiguration(supabase, currentUser.userId, parsed.data);
    return NextResponse.json({ vehicle });
  } catch {
    return NextResponse.json({ error: "Could not save garage vehicle." }, { status: 500 });
  }
}
