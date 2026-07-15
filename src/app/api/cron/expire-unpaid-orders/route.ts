import { NextResponse, type NextRequest } from "next/server";
import { expireUnpaidOrders } from "@/lib/orders/expire-unpaid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authorization = request.headers.get("authorization");

    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const result = await expireUnpaidOrders();

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
