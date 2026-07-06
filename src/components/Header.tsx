"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, PawPrint, Search, ShoppingBag, X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useCartHydrated, useCartStore } from "@/lib/cart-store";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Start" },
  { href: "/produkty", label: "Produkty" },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const itemCount = useCartStore((state) => state.getItemsCount());
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isHydrated = useCartHydrated();

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    searchInputRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, [isSearchOpen]);

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const visibleCount = isHydrated ? itemCount : 0;

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    const href = query
      ? `/produkty?q=${encodeURIComponent(query)}`
      : "/produkty";

    setIsSearchOpen(false);
    setIsOpen(false);
    router.push(href);
  };

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
          <button
            type="button"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[#1f1f1f] transition hover:border-[#1f1f1f]",
              isSearchOpen ? "border-[#1f1f1f]" : "border-[#e7dfd2]",
            )}
            onClick={() => {
              setIsSearchOpen((value) => !value);
              setIsOpen(false);
            }}
            aria-expanded={isSearchOpen}
            aria-controls="product-search-panel"
            aria-label={
              isSearchOpen
                ? "Zamknij wyszukiwanie produktów"
                : "Wyszukaj produkty"
            }
            title="Wyszukaj produkty"
          >
            {isSearchOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Search className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
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
            onClick={() => {
              setIsOpen((value) => !value);
              setIsSearchOpen(false);
            }}
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

      {isSearchOpen ? (
        <div
          id="product-search-panel"
          className="border-t border-[#eee7db] bg-white"
        >
          <form
            className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3 sm:px-6"
            onSubmit={handleSearchSubmit}
            role="search"
          >
            <label htmlFor="navbar-product-search" className="sr-only">
              Wyszukaj produkt
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b857d]"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                id="navbar-product-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Szukaj po nazwie, kategorii lub ID..."
                autoComplete="off"
                className="h-12 w-full rounded-lg border border-[#ddd3c4] bg-[#fffdf8] pl-12 pr-4 text-base text-[#1f1f1f] outline-none transition placeholder:text-[#9a948c] focus:border-[#1f1f1f]"
              />
            </div>
            <button
              type="submit"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1f1f1f] text-white transition hover:bg-[#34302d]"
              aria-label="Szukaj"
              title="Szukaj"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </div>
      ) : null}

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
