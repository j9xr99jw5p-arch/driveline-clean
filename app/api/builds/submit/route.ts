import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const optionalText = z.string().trim().optional().transform((value) => value || null);

const schema = z.object({
  year: z.coerce.number().int().min(1995).max(2035),
  trim: z.string().min(1),
  cab: z.string().min(1),
  bed: z.string().min(1),
  tire_size: z.string().min(5),
  tire_brand: optionalText,
  tire_model: optionalText,
  wheel_size: z.string().min(2),
  wheel_brand: optionalText,
  wheel_model: optionalText,
  wheel_offset: z.coerce.number().min(-80).max(80),
  lift_height: z.coerce.number().min(0).max(10),
  suspension_setup: z.string().min(1),
  suspension_brand: optionalText,
  suspension_model: optionalText,
  suspension_type: optionalText,
  rubbing_severity: z.string().min(1),
  trimming_required: z.enum(["true", "false"]).transform((value) => value === "true"),
  body_mount_chop: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: z.string().min(10),
  owner_name: z.string().min(1),
  owner_email: z.string().email(),
  source_url: z.string().url(),
  photo_url: z.string().url().optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid build submission." }, { status: 400 });

  const authSupabase = await createSupabaseServerClient();
  const currentUser = await getCurrentSupabaseUser(authSupabase);
  const supabase = createSupabaseAdminClient();
  const { owner_email, photo_url, notes, ...build } = parsed.data;
  const { error } = await supabase.from("verified_builds").insert({
    ...build,
    user_id: currentUser?.userId ?? null,
    make: "Toyota",
    model: "Tacoma",
    notes: `${notes}\n\nOwner email: ${owner_email}${photo_url ? `\nPhoto URL: ${photo_url}` : ""}`,
    fitment_risk: "medium",
    published: false
  });
  if (error) return NextResponse.json({ error: "Could not submit build." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
