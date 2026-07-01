import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Regulamin | Pawly",
};

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
        Regulamin
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
        Regulamin sklepu Pawly
      </h1>
      <div className="mt-8 space-y-6 rounded-lg border border-[#eee7db] bg-white p-6 text-sm leading-7 text-[#5f5a52] shadow-sm">
        <p>
          Ten regulamin jest placeholderem do późniejszej edycji. Sklep Pawly
          działa obecnie testowo i służy do przyjmowania prostych zamówień.
        </p>
        <p>
          Płatność odbywa się ręcznie: BLIK na telefon lub przelew bankowy po
          potwierdzeniu zamówienia.
        </p>
        <p>
          Wysyłka jest obsługiwana ręcznie. Dostępne metody dostawy są widoczne
          w koszyku oraz formularzu zamówienia.
        </p>
        <p>
          Klient ma 14 dni na odstąpienie od umowy, zgodnie z obowiązującymi
          przepisami. Szczegółowy tekst regulaminu zostanie uzupełniony przed
          uruchomieniem sprzedaży produkcyjnej.
        </p>
      </div>
    </section>
  );
}
