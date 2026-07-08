import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rejectCrossOriginRequest, rejectLargeRequest } from "@/lib/security";

export async function POST(request: NextRequest) {
  const invalidOrigin = rejectCrossOriginRequest(request);

  if (invalidOrigin) {
    return invalidOrigin;
  }

  const tooLarge = rejectLargeRequest(request, 2 * 1024);

  if (tooLarge) {
    return tooLarge;
  }

  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Zaloguj się do panelu admina." },
      { status: 401 },
    );
  }

  if (adminSession.status !== "admin") {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Brak uprawnień admina." },
      { status: 403 },
    );
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from("conversion_events")
    .delete()
    .not("id", "is", null);

  if (error) {
    return NextResponse.json(
      {
        error: "RESET_FAILED",
        message: "Nie udało się wyzerować konwersji.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
