import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseBrowserEnv, getSupabaseServiceEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/supabase";

export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseBrowserEnv();

  if (!url || !publishableKey) {
    throw new Error("Brak konfiguracji Supabase SSR.");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Proxy refreshes them.
        }
      },
    },
  });
}

export function createSupabaseServiceClient() {
  const { url, secretKey } = getSupabaseServiceEnv();

  if (!url || !secretKey) {
    throw new Error("Brak konfiguracji Supabase service role.");
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
