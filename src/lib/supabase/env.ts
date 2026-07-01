export function getSupabaseBrowserEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function hasSupabaseBrowserEnv() {
  const { url, publishableKey } = getSupabaseBrowserEnv();

  return Boolean(url && publishableKey);
}

export function getSupabaseServiceEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey:
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function hasSupabaseServiceEnv() {
  const { url, secretKey } = getSupabaseServiceEnv();

  return Boolean(url && secretKey);
}
