import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const source = String(body.source || "pricing").trim() || "pricing";

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Valid email is required." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase email capture env vars", {
        hasUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey)
      });

      return NextResponse.json(
        { error: "Missing Supabase server configuration." },
        { status: 500 }
      );
    }

    let userId: string | null = null;
    try {
      const authSupabase = await createSupabaseServerClient();
      const currentUser = await getCurrentSupabaseUser(authSupabase);
      userId = currentUser?.userId ?? null;
    } catch (error) {
      console.error("Email capture auth lookup failed:", error);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { error } = await supabase
      .from("customer_emails")
      .upsert(
        {
          email,
          ...(userId ? { user_id: userId } : {}),
          source,
          last_seen_at: new Date().toISOString()
        },
        {
          onConflict: "email"
        }
      );

    if (error) {
      console.error("customer_emails upsert failed:", error);

      return NextResponse.json(
        {
          error: "Supabase insert failed.",
          details: error.message,
          code: error.code
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, linkedUser: Boolean(userId) });
  } catch (error) {
    console.error("Email capture route crashed:", error);

    return NextResponse.json(
      { error: "Email capture failed." },
      { status: 500 }
    );
  }
}
