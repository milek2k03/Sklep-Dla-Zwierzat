import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności | Pawly",
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
        Prywatność
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
        Polityka prywatności
      </h1>
      <div className="mt-8 space-y-6 rounded-lg border border-[#eee7db] bg-white p-6 text-sm leading-7 text-[#5f5a52] shadow-sm">
        <p>
          To jest placeholder polityki prywatności do późniejszej edycji. Na
          tym etapie sklep zapisuje koszyk i złożone zamówienie lokalnie w
          przeglądarce użytkownika.
        </p>
        <p>
          Formularz zamówienia służy wyłącznie do przygotowania lokalnego
          podsumowania. Dane nie są wysyłane do zewnętrznych usług, ponieważ MVP
          nie korzysta jeszcze z backendu ani integracji płatności.
        </p>
        <p>
          Pełna polityka prywatności zostanie uzupełniona przed uruchomieniem
          sprzedaży produkcyjnej.
        </p>
      </div>
    </section>
  );
}
