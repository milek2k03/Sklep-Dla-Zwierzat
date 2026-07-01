import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, PackageCheck, ShieldCheck } from "lucide-react";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { formatPrice } from "@/lib/format";
import { getAdminSession } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata: Metadata = {
  title: "Panel admina | Pawly",
};

export const dynamic = "force-dynamic";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items: Database["public"]["Tables"]["order_items"]["Row"][];
};

export default async function AdminPage() {
  const adminSession = await getAdminSession();

  if (adminSession.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (adminSession.status === "unconfigured") {
    return (
      <AdminNotice
        title="Supabase nie jest skonfigurowany"
        text="Ustaw NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY oraz SUPABASE_SECRET_KEY w .env.local, a potem uruchom migrację SQL."
      />
    );
  }

  if (adminSession.status === "forbidden") {
    return (
      <AdminNotice
        title="Brak dostępu do panelu"
        text="Jesteś zalogowany, ale Twoje konto nie ma roli admina w tabeli admin_profiles."
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = (data ?? []) as OrderRow[];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#2f6b3f]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Dostęp chroniony
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Zamówienia Pawly
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6d675f]">
              Zalogowano jako {adminSession.email ?? "admin"}. Widok korzysta z
              RLS i serwerowej weryfikacji roli.
            </p>
          </div>
          <AdminSignOutButton />
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-[#f3cbbd] bg-[#fff1e8] p-5 text-sm text-[#a64022]">
          Nie udało się pobrać zamówień. Sprawdź migrację SQL i polityki RLS.
        </div>
      ) : null}

      <div className="mt-6 overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm">
        {orders.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              <PackageCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-[#1f1f1f]">
              Brak zamówień
            </h2>
            <p className="mt-2 text-sm text-[#6d675f]">
              Gdy klient złoży zamówienie przez checkout, pojawi się tutaj.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#eee7db]">
            {orders.map((order) => (
              <article key={order.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold text-[#1f1f1f]">
                        {order.order_number}
                      </h2>
                      <span className="rounded-full bg-[#f7f1e8] px-3 py-1 text-xs font-semibold text-[#6d675f]">
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#6d675f]">
                      {order.customer_full_name} • {order.customer_email} •{" "}
                      {order.customer_phone}
                    </p>
                    <p className="mt-1 text-sm text-[#6d675f]">
                      {new Date(order.created_at).toLocaleString("pl-PL")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[#1f1f1f] px-4 py-3 text-right text-white">
                    <p className="text-xs text-white/62">Razem</p>
                    <p className="text-xl font-semibold">
                      {formatPrice(Number(order.total))}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
                  <div className="rounded-lg bg-[#fffdf8] p-4">
                    <p className="text-sm font-semibold text-[#1f1f1f]">
                      Produkty
                    </p>
                    <div className="mt-3 space-y-2">
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-3 text-sm text-[#6d675f]"
                        >
                          <span>
                            {item.product_name} × {item.quantity}
                          </span>
                          <span className="font-semibold text-[#1f1f1f]">
                            {formatPrice(Number(item.line_total))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#fffdf8] p-4 text-sm text-[#6d675f]">
                    <p className="font-semibold text-[#1f1f1f]">Dostawa</p>
                    <p className="mt-2">{order.delivery_method}</p>
                    <p className="mt-1">{order.delivery_address}</p>
                    {order.pickup_point ? (
                      <p className="mt-1">Punkt: {order.pickup_point}</p>
                    ) : null}
                    {order.notes ? (
                      <p className="mt-3 border-t border-[#eee7db] pt-3">
                        {order.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AdminNotice({ title, text }: { title: string; text: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-[#f3cbbd] bg-white p-6 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fff1e8] text-[#a64022]">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-[#1f1f1f]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#6d675f]">{text}</p>
      </div>
    </section>
  );
}
