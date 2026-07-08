import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, rejectCrossOriginRequest, rejectLargeRequest } from "@/lib/security";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_LIMIT = 12;
const LOGIN_EMAIL_LIMIT = 6;

export async function POST(request: NextRequest) {
  const invalidOrigin = rejectCrossOriginRequest(request);

  if (invalidOrigin) {
    return invalidOrigin;
  }

  const tooLarge = rejectLargeRequest(request, 8 * 1024);

  if (tooLarge) {
    return tooLarge;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Niepoprawny format danych." },
      { status: 400 },
    );
  }

  const email = getStringPayloadValue(payload, "email").toLowerCase();
  const password = getStringPayloadValue(payload, "password");

  if (!email || !password) {
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS", message: "Nieprawidłowy e-mail lub hasło." },
      { status: 401 },
    );
  }

  const ip = getClientIp(request);
  const ipLimit = checkRateLimit(`admin-login-ip:${ip}`, {
    limit: LOGIN_IP_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
  });
  const emailLimit = checkRateLimit(`admin-login-email:${email}`, {
    limit: LOGIN_EMAIL_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
  });

  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      {
        error: "TOO_MANY_REQUESTS",
        message: "Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(ipLimit.retryAfter ?? emailLimit.retryAfter ?? 60),
        },
      },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: "INVALID_CREDENTIALS", message: "Nieprawidłowy e-mail lub hasło." },
      { status: 401 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    await supabase.auth.signOut();

    return NextResponse.json(
      { error: "FORBIDDEN", message: "To konto nie ma dostępu do panelu admina." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}

function getStringPayloadValue(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) {
    return "";
  }

  const value = (payload as Record<string, unknown>)[key];

  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}
