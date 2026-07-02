import Link from "next/link";
import { PawPrint } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-[#eee7db] bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-[#1f1f1f]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f1f1f] text-white">
              <PawPrint className="h-4 w-4" aria-hidden="true" />
            </span>
            Pawly
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#6d675f]">
            Starannie wybrane akcesoria dla psów na spacer, do auta i do domu.
            Prosto, wygodnie i bez bałaganu.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[#1f1f1f]">Sklep</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-[#6d675f]">
            <Link href="/produkty" className="transition hover:text-[#1f1f1f]">
              Produkty
            </Link>
            <Link href="/koszyk" className="transition hover:text-[#1f1f1f]">
              Koszyk
            </Link>
            <Link href="/zamowienie" className="transition hover:text-[#1f1f1f]">
              Zamówienie
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[#1f1f1f]">Informacje</h2>
          <div className="mt-4 flex flex-col gap-3 text-sm text-[#6d675f]">
            <Link
              href="/zamowienie/status"
              className="transition hover:text-[#1f1f1f]"
            >
              Status zamówienia
            </Link>
            <Link href="/regulamin" className="transition hover:text-[#1f1f1f]">
              Regulamin
            </Link>
            <Link
              href="/polityka-prywatnosci"
              className="transition hover:text-[#1f1f1f]"
            >
              Polityka prywatności
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#f1eadf] px-4 py-5 text-center text-xs text-[#7a746d]">
        © 2026 Pawly. Sklep w wersji testowej.
      </div>
    </footer>
  );
}
