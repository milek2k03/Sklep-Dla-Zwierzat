import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getResendClient } from "@/lib/email/server";

const CAMPAIGN_EPOCH = Date.UTC(2026, 0, 1);

export function getCampaignKey(now: Date) {
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw", weekday: "short", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const weekday = local.find((part) => part.type === "weekday")?.value;
  const hour = Number(local.find((part) => part.type === "hour")?.value);
  if (weekday !== "Thu" || hour < 10 || hour > 12) return null;
  const week = Math.floor((now.getTime() - CAMPAIGN_EPOCH) / (7 * 86400000));
  if (week < 0 || week % 4 !== 0) return null;
  return `pawly-products-${Math.floor(week / 4)}`;
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeUnsubscribeToken(email: string, consentedAt: string, secret: string) {
  const payload = Buffer.from(JSON.stringify([email, consentedAt])).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string) {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra || payload.length > 2048) return null;
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== 2 || typeof parsed[0] !== "string" ||
      typeof parsed[1] !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed[0]) ||
      Number.isNaN(Date.parse(parsed[1]))) return null;
    return { email: parsed[0], consentedAt: parsed[1] };
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

export async function sendMarketingCampaign(now = new Date()) {
  const campaignKey = getCampaignKey(now);
  if (!campaignKey) return { skipped: "outside_window" };
  if (process.env.MARKETING_ENABLED !== "true") return { skipped: "disabled" };
  const secret = process.env.MARKETING_UNSUBSCRIBE_SECRET;
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  const from = process.env.STORE_FROM_EMAIL;
  const postalAddress = process.env.MARKETING_POSTAL_ADDRESS;
  if (!secret || secret.length < 32 || !origin?.startsWith("https://") || !from ||
    !postalAddress || !process.env.RESEND_API_KEY) throw new Error("MARKETING_CONFIG_INCOMPLETE");

  const supabase = createSupabaseServiceClient();
  const { data: recipients, error } = await supabase.from("marketing_preferences")
    .select("email, last_consented_at").eq("is_active", true)
    .order("email").limit(51);
  if (error) throw error;
  if ((recipients?.length ?? 0) > 50) throw new Error("MARKETING_RECIPIENT_LIMIT_EXCEEDED");
  if (!recipients?.length) return { sent: 0, failed: 0 };

  const { data: products, error: productError } = await supabase.from("products")
    .select("name, slug, price").eq("is_active", true).gt("stock_quantity", 0)
    .order("created_at", { ascending: false }).limit(3);
  if (productError) throw productError;
  if (!products?.length) return { skipped: "no_products" };

  const resend = getResendClient();
  const featured = products.map((product) => `${product.name} - ${Number(product.price).toFixed(2)} zł`);
  const links = products.map((product) => ({
    label: `${product.name} - ${Number(product.price).toFixed(2)} zł`,
    href: new URL(`/produkt/${encodeURIComponent(product.slug)}`, origin).toString(),
  }));
  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const { data: claimed, error: claimError } = await supabase.rpc("claim_marketing_mailing", {
      p_campaign_key: campaignKey, p_email: recipient.email,
    });
    if (claimError) throw claimError;
    if (!claimed) continue;
    const { data: current, error: eligibilityError } = await supabase
      .from("marketing_preferences").select("is_active, last_consented_at")
      .eq("email", recipient.email).single();
    if (eligibilityError || !current?.is_active || current.last_consented_at !== recipient.last_consented_at) {
      await supabase.from("marketing_mailings").update({ status: "failed" })
        .eq("campaign_key", campaignKey).eq("email", recipient.email);
      continue;
    }

    const token = makeUnsubscribeToken(recipient.email, recipient.last_consented_at, secret);
    const unsubscribe = new URL(`/wypisz?token=${encodeURIComponent(token)}`, origin).toString();
    const oneClickUnsubscribe = new URL(`/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`, origin).toString();
    const text = `Pawly: praktyczne akcesoria dla psów i kotów.\n\n${featured.join("\n")}\n\nZobacz produkty: ${origin}/produkty\n\nWypisz się: ${unsubscribe}\n${postalAddress}`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#252525"><h1 style="font-size:24px">Pawly</h1><p>Praktyczne akcesoria dla psów i kotów</p><ul>${links.map((link) => `<li style="margin:12px 0"><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul><p><a href="${escapeHtml(new URL("/produkty", origin).toString())}">Zobacz wszystkie produkty</a></p><hr><p style="font-size:12px;color:#666">Otrzymujesz tę wiadomość, ponieważ wyrażono zgodę na maile promocyjne Pawly. <a href="${escapeHtml(unsubscribe)}">Wypisz się</a><br>${escapeHtml(postalAddress)}</p></div>`;
    try {
      const { data, error: sendError } = await resend.emails.send({
        from, to: recipient.email, subject: "Pawly: akcesoria dla psa i kota",
        text, html, headers: { "List-Unsubscribe": `<${oneClickUnsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }, { idempotencyKey: `${campaignKey}/${recipient.email}` });
      if (sendError || !data?.id) throw sendError ?? new Error("RESEND_NO_ID");
      const { error: saveError } = await supabase.from("marketing_mailings")
        .update({ status: "sent", provider_id: data.id, sent_at: new Date().toISOString() })
        .eq("campaign_key", campaignKey).eq("email", recipient.email);
      if (saveError) throw saveError;
      sent++;
    } catch (error) {
      console.error("Marketing delivery failed", { campaignKey, email: recipient.email, error });
      await supabase.from("marketing_mailings").update({ status: "failed" })
        .eq("campaign_key", campaignKey).eq("email", recipient.email);
      failed++;
    }
  }
  return { sent, failed };
}
