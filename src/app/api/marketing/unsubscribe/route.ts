import { NextResponse, type NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/marketing";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET;
  const contact = secret ? verifyUnsubscribeToken(token, secret) : null;
  if (!contact) return NextResponse.json({ error: "INVALID_LINK" }, { status: 400 });
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.rpc("unsubscribe_marketing", {
    p_email: contact.email, p_consented_at: contact.consentedAt,
  });
  if (error) return NextResponse.json({ error: "UNSUBSCRIBE_FAILED" }, { status: 503 });
  if (request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") &&
    (await request.formData()).get("manual") === "1") {
    return NextResponse.redirect(new URL("/wypisz?done=1", request.url), 303);
  }
  return NextResponse.json({ ok: true });
}
