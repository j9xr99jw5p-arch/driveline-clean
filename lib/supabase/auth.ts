import type { User } from "@supabase/supabase-js";

type SupabaseAuthClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: User | null };
      error: unknown;
    }>;
  };
};

export type CurrentSupabaseUser = {
  user: User;
  userId: string;
};

export async function getCurrentSupabaseUser(supabase: SupabaseAuthClient): Promise<CurrentSupabaseUser | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  return {
    user: data.user,
    userId: data.user.id
  };
}

export function isSupabaseAuthUserId(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
