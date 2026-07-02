"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PawPrint, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { useCartHydrated, useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Start" },
  { href: "/produkty", label: "Produkty" },
];

export function Header() {
  const pathname = usePathname();
  const itemCount = useCartStore((state) => state.getItemsCount());
  const [isOpen, setIsOpen] = useState(false);
  const isHydrated = useCartHydrated();

  const visibleCount = isHydrated ? itemCount : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-[#eee7db] bg-[#fffdf8]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-[#1f1f1f]"
          onClick={() => setIsOpen(false)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-white">
            <PawPrint className="h-4 w-4" aria-hidden="true" />
          </span>
          Pawly
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-[#5f5a52] md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition hover:text-[#1f1f1f]",
                pathname === item.href && "text-[#1f1f1f]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/produkty"
            className="hidden min-h-10 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#34302d] md:inline-flex"
          >
            Zobacz produkty
          </Link>
          <Link
            href="/koszyk"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e7dfd2] bg-white text-[#1f1f1f] transition hover:border-[#1f1f1f]"
            aria-label={`Koszyk, liczba produktów: ${visibleCount}`}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e86f2c] px-1 text-[11px] font-semibold text-white">
              {visibleCount}
            </span>
          </Link>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e7dfd2] bg-white text-[#1f1f1f] md:hidden"
            onClick={() => setIsOpen((value) => !value)}
            aria-expanded={isOpen}
            aria-label={isOpen ? "Zamknij menu" : "Otwórz menu"}
          >
            {isOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="border-t border-[#eee7db] bg-[#fffdf8] px-4 py-3 md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-3 text-sm font-medium text-[#5f5a52]",
                  pathname === item.href && "bg-[#f4eddf] text-[#1f1f1f]",
                )}
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/koszyk"
              className="rounded-lg px-3 py-3 text-sm font-semibold text-[#1f1f1f]"
              onClick={() => setIsOpen(false)}
            >
              Koszyk ({visibleCount})
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
