import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, MailCheck, Search } from "lucide-react";
import { MarketingRevokeForm } from "@/components/admin/MarketingRevokeForm";
import { storeBrandName } from "@/lib/brand";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: `Zgody e-mail admin | ${storeBrandName}`,
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
  saved?: string;
  error?: string;
}>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function pageHref(page: number, q: string, status: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/admin/marketing${params.size ? `?${params}` : ""}`;
}

export default async function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  const adminSession = await getAdminSession();
  if (adminSession.status === "unauthenticated") redirect("/admin/login");
  if (adminSession.status !== "admin") redirect("/admin");

  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 180);
  const status = params.status === "active" || params.status === "inactive" ? params.status : "all";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("marketing_preferences")
    .select("email, is_active, last_consented_at, revoked_at", { count: "exact" })
    .order("last_consented_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("email", `%${q}%`);
  if (status !== "all") query = query.eq("is_active", status === "active");
  const { data: contacts, count, error } = await query;
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="border-b border-white/10 pb-6">
        <p className="flex items-center gap-2 text-sm font-semibold uppercase text-[#f4a261]"><MailCheck className="h-4 w-4" aria-hidden="true" /> Marketing</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#f5f7fb]">Zgody e-mail</h1>
        <p className="mt-2 text-sm leading-6 text-[#aeb8c8]">Wyłączenie blokuje maile promocyjne. Późniejsza zgoda klienta przy zakupie włącza je ponownie.</p>
      </div>

      {params.saved ? <p role="status" className="mt-5 rounded-md border border-[#356b55] bg-[#18392d] p-4 text-sm font-medium text-[#b4f4d2]">Maile promocyjne dla tego adresu zostały wyłączone.</p> : null}
      {params.error ? <p role="alert" className="mt-5 rounded-md border border-[#8b4240] bg-[#422427] p-4 text-sm font-medium text-[#ffd5d0]">{params.error === "already_inactive" ? "Ten adres jest już wyłączony." : "Nie udało się zmienić zgody. Sprawdź migrację bazy i spróbuj ponownie."}</p> : null}
      {error ? <p role="alert" className="mt-5 rounded-md border border-[#8b4240] bg-[#422427] p-4 text-sm font-medium text-[#ffd5d0]">Nie udało się pobrać listy. Uruchom migracje 029 i 030 w Supabase.</p> : null}

      <form action="/admin/marketing" className="mt-6 flex flex-col gap-3 rounded-md border border-[#35404e] bg-[#1b2028] p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-medium text-[#d9e0ea]">
          Adres e-mail
          <input name="q" defaultValue={q} type="search" placeholder="Szukaj adresu e-mail" className="mt-2 block min-h-11 w-full rounded-md border border-[#465161] bg-[#14181e] px-3 text-[#f5f7fb] outline-none placeholder:text-[#7e8998] focus:border-[#f4a261]" />
        </label>
        {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#f4a261] px-5 text-sm font-semibold text-[#15171b] hover:bg-[#ffb779]"><Search className="h-4 w-4" aria-hidden="true" /> Szukaj</button>
      </form>

      <nav aria-label="Status zgody" className="mt-5 flex flex-wrap gap-2">
        {([ ["all", "Wszystkie"], ["active", "Aktywne"], ["inactive", "Wyłączone"] ] as const).map(([value, label]) => (
          <Link key={value} href={pageHref(1, q, value)} aria-current={status === value ? "page" : undefined} className={`rounded-md border px-4 py-2 text-sm font-semibold ${status === value ? "border-[#f4a261] bg-[#f4a261] text-[#15171b]" : "border-[#465161] bg-[#222832] text-[#d9e0ea] hover:border-[#f4a261]"}`}>{label}</Link>
        ))}
      </nav>

      <div className="mt-5 overflow-hidden rounded-md border border-[#35404e] bg-[#1b2028]">
        <div className="border-b border-[#35404e] px-4 py-3 text-sm text-[#aeb8c8]">{count ?? 0} adresów</div>
        {!error && contacts?.length === 0 ? <p className="px-4 py-10 text-center text-sm text-[#aeb8c8]">Brak adresów dla tego filtra.</p> : null}
        {contacts?.map((contact) => (
          <div key={contact.email} className="flex flex-col gap-3 border-b border-[#35404e] px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-all font-semibold text-[#f5f7fb]">{contact.email}</p>
              <p className="mt-1 text-xs text-[#aeb8c8]">Zgoda: {formatDate(contact.last_consented_at)}{contact.revoked_at ? ` · Wyłączono: ${formatDate(contact.revoked_at)}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ${contact.is_active ? "bg-[#18392d] text-[#b4f4d2]" : "bg-[#30353d] text-[#b8c2d0]"}`}>{contact.is_active ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}{contact.is_active ? "Aktywna" : "Wyłączona"}</span>
              {contact.is_active ? <MarketingRevokeForm email={contact.email} /> : null}
            </div>
          </div>
        ))}
      </div>

      {!error && totalPages > 1 ? <nav aria-label="Strony zgód" className="mt-5 flex items-center justify-between gap-4 text-sm text-[#d9e0ea]">
        {page > 1 ? <Link href={pageHref(page - 1, q, status)} className="inline-flex items-center gap-1 rounded-md border border-[#465161] px-3 py-2 hover:border-[#f4a261]"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Poprzednia</Link> : <span />}
        <span>Strona {page} z {totalPages}</span>
        {page < totalPages ? <Link href={pageHref(page + 1, q, status)} className="inline-flex items-center gap-1 rounded-md border border-[#465161] px-3 py-2 hover:border-[#f4a261]">Następna <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link> : <span />}
      </nav> : null}
    </section>
  );
}
