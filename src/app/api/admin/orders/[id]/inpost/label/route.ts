import { InpostApiError } from "@/lib/inpost/client";
import { downloadInpostLabelForOrder } from "@/lib/inpost/shipments";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const adminSession = await getAdminSession();

  if (adminSession.status !== "admin") {
    const status =
      adminSession.status === "unconfigured"
        ? 503
        : adminSession.status === "forbidden"
          ? 403
          : 401;

    return Response.json(
      {
        error: "ADMIN_ACCESS_REQUIRED",
        message: "Zaloguj się jako administrator.",
      },
      { status },
    );
  }

  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("id", id)
    .single();

  if (error || !order) {
    return Response.json(
      {
        error: "ORDER_NOT_FOUND",
        message: "Nie znaleziono zamówienia.",
      },
      { status: 404 },
    );
  }

  try {
    const label = await downloadInpostLabelForOrder(order.id);
    const safeOrderNumber = order.order_number.replace(/[^A-Za-z0-9_-]/g, "_");

    return new Response(label.bytes, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="etykieta-inpost-${safeOrderNumber}.pdf"`,
        "Content-Type": label.contentType,
      },
    });
  } catch (error) {
    const status = error instanceof InpostApiError ? error.status : 500;

    return Response.json(
      {
        error: "INPOST_LABEL_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się pobrać etykiety InPost.",
      },
      { status },
    );
  }
}
