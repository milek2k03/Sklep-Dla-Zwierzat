import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/env";

export const getAdminSession = cache(async () => {
  if (!hasSupabaseBrowserEnv()) {
    return {
      status: "unconfigured" as const,
      userId: null,
      email: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return {
      status: "unauthenticated" as const,
      userId: null,
      email: null,
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", data.claims.sub)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return {
      status: "forbidden" as const,
      userId: data.claims.sub,
      email: typeof data.claims.email === "string" ? data.claims.email : null,
    };
  }

  return {
    status: "admin" as const,
    userId: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
  };
});
