import { hasSupabaseServiceEnv } from "@/lib/supabase/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining?: number;
  retryAfter?: number;
};

export async function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): Promise<RateLimitResult> {
  if (hasSupabaseServiceEnv()) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .rpc("check_rate_limit", {
          p_key: normalizeRateLimitKey(key),
          p_limit: options.limit,
          p_window_seconds: Math.ceil(options.windowMs / 1000),
        })
        .single();

      if (!error && data) {
        return {
          allowed: data.allowed,
          remaining: data.remaining,
          retryAfter: data.retry_after || undefined,
        };
      }

      console.error("Persistent rate limit failed", error);
    } catch (error) {
      console.error("Persistent rate limit unavailable", error);
    }
  }

  return checkMemoryRateLimit(key, options);
}

function checkMemoryRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const normalizedKey = normalizeRateLimitKey(key);
  const bucket = buckets.get(normalizedKey);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(normalizedKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return { allowed: true, remaining: options.limit - 1 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;

  return {
    allowed: true,
    remaining: options.limit - bucket.count,
  };
}

function normalizeRateLimitKey(key: string) {
  return key.trim().slice(0, 240) || "unknown";
}
