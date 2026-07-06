"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, PawPrint, Search, ShoppingBag, X } from "lucide-react";
import {
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";
import { useCartHydrated, useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Start" },
  { href: "/produkty", label: "Produkty" },
];

type ProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const itemCount = useCartStore((state) => state.getItemsCount());
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const isHydrated = useCartHydrated();

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const response = await fetch(
          `/api/products/search?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const payload = (await response.json()) as {
          suggestions?: ProductSuggestion[];
        };
        setSuggestions(payload.suggestions ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

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

    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setIsOpen(false);
    router.push(href);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setIsSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    if (suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSuggestionsOpen(true);
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex >= suggestions.length - 1 ? 0 : currentIndex + 1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsSuggestionsOpen(true);
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      openSuggestion(suggestions[activeSuggestionIndex]);
    }
  };

  const handleSearchBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  };

  const openSuggestion = (suggestion: ProductSuggestion) => {
    setSearchQuery(suggestion.name);
    setIsSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    setIsOpen(false);
    router.push(`/produkt/${suggestion.slug}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#eee7db] bg-[#fffdf8]/95 backdrop-blur">
      <div className="mx-auto grid min-h-16 w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 md:grid-cols-[auto_auto_minmax(220px,1fr)_auto] md:gap-x-5 md:py-0 lg:px-8">
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

        <nav className="hidden items-center gap-5 text-sm font-medium text-[#5f5a52] md:flex lg:gap-7">
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

        <form
          className="relative col-span-3 row-start-2 w-full md:col-span-1 md:row-start-1 md:max-w-xl"
          onSubmit={handleSearchSubmit}
          onBlur={handleSearchBlur}
          role="search"
        >
          <label htmlFor="navbar-product-search" className="sr-only">
            Wyszukaj produkt
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b857d]"
            aria-hidden="true"
          />
          <input
            id="navbar-product-search"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="navbar-product-suggestions"
            aria-expanded={isSuggestionsOpen}
            aria-activedescendant={
              activeSuggestionIndex >= 0
                ? `product-suggestion-${activeSuggestionIndex}`
                : undefined
            }
            value={searchQuery}
            onChange={(event) => {
              const nextQuery = event.target.value;

              setSearchQuery(nextQuery);
              setSuggestions([]);
              setIsSearching(nextQuery.trim().length >= 2);
              setIsSuggestionsOpen(true);
              setActiveSuggestionIndex(-1);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) {
                setIsSuggestionsOpen(true);
              }
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Szukaj produktów..."
            autoComplete="off"
            className="h-10 w-full rounded-lg border border-[#ddd3c4] bg-white pl-10 pr-10 text-sm text-[#1f1f1f] outline-none transition placeholder:text-[#9a948c] focus:border-[#1f1f1f]"
          />
          <button
            type="submit"
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#5f5a52] transition hover:bg-[#f4eddf] hover:text-[#1f1f1f]"
            aria-label="Szukaj"
            title="Szukaj"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>

          {isSuggestionsOpen && searchQuery.trim().length >= 2 ? (
            <div
              id="navbar-product-suggestions"
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-lg border border-[#e7dfd2] bg-white shadow-xl shadow-[#4b3420]/10"
            >
              {isSearching ? (
                <p className="px-4 py-4 text-sm text-[#7a746d]">
                  Szukam produktów...
                </p>
              ) : suggestions.length > 0 ? (
                <>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      id={`product-suggestion-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeSuggestionIndex === index}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 border-b border-[#f0e9de] px-4 py-3 text-left transition last:border-b-0",
                        activeSuggestionIndex === index
                          ? "bg-[#f7f1e8]"
                          : "hover:bg-[#fffaf2]",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => openSuggestion(suggestion)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[#1f1f1f]">
                          {suggestion.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[#7a746d]">
                          {suggestion.category} · {suggestion.id}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-[#1f1f1f]">
                        {formatPrice(suggestion.price)}
                      </span>
                    </button>
                  ))}
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 border-t border-[#e7dfd2] bg-[#fffdf8] px-4 py-3 text-left text-sm font-semibold text-[#b65320] transition hover:bg-[#f7f1e8]"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Zobacz wszystkie wyniki
                  </button>
                </>
              ) : (
                <p className="px-4 py-4 text-sm text-[#7a746d]">
                  Brak pasujących produktów. Naciśnij Enter, aby przeszukać
                  cały katalog.
                </p>
              )}
            </div>
          ) : null}
        </form>

        <div className="col-start-3 row-start-1 flex items-center justify-end gap-2 md:col-start-4">
          <Link
            href="/produkty"
            className="hidden min-h-10 items-center justify-center rounded-full bg-[#1f1f1f] px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#34302d] lg:inline-flex"
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
              setIsSuggestionsOpen(false);
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
