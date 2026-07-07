"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  Boxes,
  ClipboardList,
  Home,
  LayoutDashboard,
  ReceiptText,
  RotateCcw,
  Store,
} from "lucide-react";
import type { ReactNode } from "react";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { storeBrandName } from "@/lib/brand";
import { cn } from "@/lib/utils";

const adminNavItems = [
  {
    href: "/admin",
    label: "Zamowienia",
    description: "Obsluga i statusy",
    icon: ClipboardList,
    exact: true,
  },
  {
    href: "/admin/products",
    label: "Produkty",
    description: "Katalog i magazyn",
    icon: Boxes,
  },
  {
    href: "/admin/discounts",
    label: "Rabaty",
    description: "Kody promocyjne",
    icon: BadgePercent,
  },
  {
    href: "/admin/returns",
    label: "Zwroty",
    description: "Reklamacje i wymiany",
    icon: RotateCcw,
  },
  {
    href: "/admin/expenses",
    label: "Koszty",
    description: "Ewidencja wydatkow",
    icon: ReceiptText,
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return (
      <div className="admin-theme min-h-screen bg-[#0f1115] text-[#f5f7fb]">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(244,162,97,0.14),transparent_34%),linear-gradient(135deg,#0f1115_0%,#17191f_54%,#101318_100%)]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-theme min-h-screen bg-[#0f1115] text-[#f5f7fb]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[292px] shrink-0 border-r border-white/10 bg-[#11151b] lg:block">
          <div className="sticky top-0 flex h-screen flex-col px-5 py-5">
            <Link
              href="/admin"
              className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-[#f5f7fb]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f4a261] text-[#121417]">
                <LayoutDashboard className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-base font-semibold leading-5">
                  {storeBrandName} Admin
                </span>
                <span className="mt-0.5 block text-xs text-[#98a2b3]">
                  Panel operacyjny
                </span>
              </span>
            </Link>

            <nav className="mt-7 space-y-1.5">
              {adminNavItems.map((item) => (
                <AdminNavLink
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  isActive={
                    item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href)
                  }
                  label={item.label}
                  description={item.description}
                />
              ))}
            </nav>

            <div className="mt-auto space-y-3 border-t border-white/10 pt-5">
              <Link
                href="/"
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-[#cbd5e1] transition hover:bg-white/7 hover:text-white"
              >
                <Store className="h-4 w-4" aria-hidden="true" />
                Sklep
              </Link>
              <AdminSignOutButton />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-0 z-30 border-b border-white/10 bg-[#0f1115]/92 px-4 py-3 backdrop-blur lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin" className="flex items-center gap-2 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f4a261] text-[#121417]">
                  <Home className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold">
                  {storeBrandName} Admin
                </span>
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-semibold text-[#cbd5e1]"
              >
                Sklep
              </Link>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition",
                      isActive
                        ? "border-[#f4a261] bg-[#f4a261] text-[#121417]"
                        : "border-white/10 bg-white/5 text-[#cbd5e1]",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <main className="min-h-screen">{children}</main>
        </div>
      </div>
    </div>
  );
}

function AdminNavLink({
  description,
  href,
  icon: Icon,
  isActive,
  label,
}: {
  description: string;
  href: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-14 items-center gap-3 rounded-lg border px-3 transition",
        isActive
          ? "border-[#f4a261]/60 bg-[#f4a261] text-[#121417] shadow-[0_14px_30px_rgba(244,162,97,0.18)]"
          : "border-transparent text-[#cbd5e1] hover:border-white/10 hover:bg-white/7 hover:text-white",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg transition",
          isActive
            ? "bg-[#121417]/12 text-[#121417]"
            : "bg-white/7 text-[#98a2b3] group-hover:text-white",
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span
          className={cn(
            "mt-0.5 block truncate text-xs",
            isActive ? "text-[#2b2117]" : "text-[#7f8a9b]",
          )}
        >
          {description}
        </span>
      </span>
    </Link>
  );
}
