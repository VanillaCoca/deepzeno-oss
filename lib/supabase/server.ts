import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppSession, AuthenticatedUser } from "./types";

export type { AppSession } from "./types";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function mapUser(user: {
  id: string;
  email?: string | null;
}): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email ?? null,
    type: "regular",
  };
}

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Cookie writes are unavailable in some Server Component contexts.
        }
      },
    },
  });
}

export async function auth(): Promise<AppSession | null> {
  const supabase = await createClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    user: mapUser(user),
  };
}

export async function requireAuth() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

export async function signOut({
  redirectTo = "/login",
}: {
  redirectTo?: string;
} = {}) {
  "use server";

  const supabase = await createClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect(redirectTo);
}
