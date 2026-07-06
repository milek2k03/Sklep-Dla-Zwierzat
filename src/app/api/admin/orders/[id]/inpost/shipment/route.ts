import { NextResponse } from "next/server";
import { InpostApiError } from "@/lib/inpost/client";
import { ensureInpostShipmentForOrder } from "@/lib/inpost/shipments";
import { getAdminSession } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unconfigured") {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: "Supabase nie jest skonfigurowany.",
      },
      { status: 503 },
    );
  }

  if (adminSession.status === "unauthenticated") {
    return NextResponse.json(
      {
        error: "UNAUTHENTICATED",
        message: "Zaloguj się do panelu admina.",
      },
      { status: 401 },
    );
  }

  if (adminSession.status === "forbidden") {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Twoje konto nie ma roli admina.",
      },
      { status: 403 },
    );
  }

  const { id } = await context.params;

  try {
    const shipment = await ensureInpostShipmentForOrder(id);

    return NextResponse.json({ shipment });
  } catch (error) {
    const status = error instanceof InpostApiError ? error.status : 500;

    return NextResponse.json(
      {
        error: "INPOST_SHIPMENT_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się utworzyć przesyłki InPost.",
      },
      { status },
    );
  }
}
