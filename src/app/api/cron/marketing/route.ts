import { NextResponse, type NextRequest } from "next/server";
import { sendMarketingCampaign } from "@/lib/email/marketing";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    return NextResponse.json(await sendMarketingCampaign());
  } catch (error) {
    console.error("Marketing cron failed", error);
    return NextResponse.json({ error: "MARKETING_FAILED" }, { status: 503 });
  }
}
