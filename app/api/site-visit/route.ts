import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  path: z.string().min(1).max(500),
  referrer: z.string().max(1000).nullable().optional(),
  userAgent: z.string().max(1000).nullable().optional()
});

export async function POST(request: Request) {
  if (!hasSupabaseServerEnv()) return NextResponse.json({ ok: true });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const currentUser = await getCurrentSupabaseUser(supabase);
    userId = currentUser?.userId ?? null;
  } catch {
    userId = null;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("site_visits").insert({
    path: parsed.data.path,
    referrer: parsed.data.referrer || null,
    user_agent: parsed.data.userAgent || null,
    user_id: userId
  });

  if (error) {
    if (error.code !== "42P01" && error.code !== "42703") {
      console.error("Site visit insert failed:", error);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
