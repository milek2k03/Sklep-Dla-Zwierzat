import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polityka prywatności | Pawly",
};

const ownerName = "Miłosz Czech";
const contactEmail = process.env.ORDER_NOTIFICATION_EMAIL ?? "pawlyassista@gmail.com";
const contactPhone = process.env.STORE_PHONE ?? "+48 531 353 773";
const contactAddress = "ul. Żwirowa 24, 86-070 Czarże, Polska";

const sections = [
  {
    title: "1. Administrator danych",
    content: [
      `Administratorem danych osobowych klientów i użytkowników sklepu Pawly jest ${ownerName}, prowadzący sprzedaż w ramach działalności nierejestrowanej, o ile spełnione są warunki ustawowe dla tej formy działalności.`,
      `Adres do korespondencji: ${contactAddress}.`,
      `Kontakt w sprawach danych osobowych: ${contactEmail}.`,
      `Telefon kontaktowy: ${contactPhone}.`,
      "Inspektor ochrony danych nie został powołany.",
    ],
  },
  {
    title: "2. Jakie dane przetwarzamy",
    content: [
      "W związku z obsługą sklepu możemy przetwarzać: imię i nazwisko, adres e-mail, numer telefonu, adres dostawy, kod punktu odbioru, dane zamówienia, dane płatności otrzymane od operatora płatności, treść wiadomości i notatek klienta, informacje o zwrotach, reklamacjach i wymianach oraz dane techniczne potrzebne do bezpieczeństwa i działania strony.",
      "Nie przechowujemy pełnych danych kart płatniczych. Dane płatnicze są obsługiwane przez operatora płatności Stripe.",
      "Koszyk jest zapisywany w pamięci przeglądarki użytkownika przez localStorage pod nazwą pawly-cart, aby klient mógł wrócić do rozpoczętych zakupów.",
    ],
  },
  {
    title: "3. Cele i podstawy prawne przetwarzania",
    content: [
      "Realizacja zamówienia, płatności, dostawy, obsługa statusu zamówienia, zwrotów, reklamacji i wymian: art. 6 ust. 1 lit. b RODO, czyli wykonanie umowy lub działania przed jej zawarciem.",
      "Wypełnianie obowiązków prawnych, w tym obowiązków konsumenckich, podatkowych, księgowych i archiwizacyjnych: art. 6 ust. 1 lit. c RODO.",
      "Kontakt z klientem, dochodzenie lub obrona roszczeń, zapobieganie nadużyciom, prowadzenie historii zdarzeń zamówienia oraz zapewnienie bezpieczeństwa sklepu: art. 6 ust. 1 lit. f RODO, czyli prawnie uzasadniony interes administratora.",
      "Jeżeli w przyszłości pojawi się newsletter lub marketing e-mailowy, będzie wymagał osobnej zgody albo innej właściwej podstawy prawnej. Obecnie sklep nie prowadzi newslettera.",
    ],
  },
  {
    title: "4. Odbiorcy danych",
    content: [
      "Dane mogą być przekazywane podmiotom, które pomagają obsłużyć sklep: dostawcy hostingu i bazy danych, operatorowi płatności, dostawcy poczty transakcyjnej, firmom kurierskim i operatorom punktów odbioru, dostawcom narzędzi technicznych oraz podmiotom uprawnionym na podstawie prawa.",
      "Aktualnie sklep korzysta z Supabase do obsługi bazy danych i autoryzacji, Stripe do płatności online oraz Resend do wysyłki e-maili transakcyjnych.",
      "Dane dostawy mogą zostać przekazane przewoźnikom takim jak InPost lub DPD, jeżeli klient wybierze daną metodę dostawy.",
    ],
  },
  {
    title: "5. Przekazywanie danych poza Europejski Obszar Gospodarczy",
    content: [
      "Niektórzy dostawcy technologiczni mogą przetwarzać dane poza Europejskim Obszarem Gospodarczym, w szczególności gdy korzystają z infrastruktury globalnej.",
      "W takim przypadku przekazywanie danych powinno odbywać się z zastosowaniem mechanizmów przewidzianych przez RODO, na przykład standardowych klauzul umownych lub innych odpowiednich zabezpieczeń.",
    ],
  },
  {
    title: "6. Czas przechowywania danych",
    content: [
      "Dane zamówień przechowujemy przez czas potrzebny do obsługi umowy, zwrotów, reklamacji, wymian, rozliczeń oraz ewentualnych roszczeń.",
      "Dane związane z obowiązkami podatkowymi i księgowymi przechowujemy przez okres wymagany przepisami prawa.",
      "Dane zwrotów, reklamacji i korespondencji przechowujemy przez okres potrzebny do rozpatrzenia sprawy oraz zabezpieczenia ewentualnych roszczeń.",
      "Dane koszyka zapisane w localStorage pozostają w przeglądarce użytkownika do czasu ich usunięcia przez użytkownika, wyczyszczenia danych przeglądarki albo opróżnienia koszyka.",
    ],
  },
  {
    title: "7. Prawa osoby, której dane dotyczą",
    content: [
      "Masz prawo dostępu do swoich danych, otrzymania ich kopii, sprostowania danych, usunięcia danych, ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu oraz cofnięcia zgody, jeżeli przetwarzanie odbywa się na podstawie zgody.",
      "Nie wszystkie żądania mogą zostać zrealizowane w pełnym zakresie, jeżeli dalsze przechowywanie danych jest wymagane przez przepisy prawa albo potrzebne do ustalenia, dochodzenia lub obrony roszczeń.",
      `Aby skorzystać z praw, napisz na adres: ${contactEmail}.`,
      "Masz także prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.",
    ],
  },
  {
    title: "8. Dobrowolność podania danych",
    content: [
      "Podanie danych potrzebnych do złożenia zamówienia jest dobrowolne, ale niezbędne do zawarcia i wykonania umowy sprzedaży, obsługi płatności, dostawy oraz zwrotów lub reklamacji.",
      "Brak podania wymaganych danych może uniemożliwić złożenie zamówienia albo obsługę zgłoszenia.",
    ],
  },
  {
    title: "9. Zautomatyzowane decyzje i profilowanie",
    content: [
      "Sklep nie podejmuje wobec klientów decyzji wywołujących skutki prawne w sposób wyłącznie zautomatyzowany.",
      "Sklep nie prowadzi profilowania marketingowego. System może automatycznie przeliczać koszyk, rabaty, dostępny stan magazynowy, koszt dostawy oraz status zamówienia.",
    ],
  },
  {
    title: "10. Cookies i localStorage",
    content: [
      "Strona może korzystać z technicznych cookies lub podobnych technologii potrzebnych do działania aplikacji, bezpieczeństwa, utrzymania sesji administracyjnej i poprawnego wyświetlania strony.",
      "Koszyk klienta jest zapisywany w localStorage przeglądarki. Dane te są przechowywane lokalnie na urządzeniu użytkownika i mogą zostać usunięte przez wyczyszczenie danych strony w przeglądarce.",
      "Obecnie sklep nie korzysta z banerów reklamowych, newslettera ani narzędzi marketingowych opisujących zachowanie klienta w celach reklamowych.",
    ],
  },
  {
    title: "11. Bezpieczeństwo",
    content: [
      "Dostęp do panelu administracyjnego jest ograniczony do kont z rolą administratora.",
      "Dane operacyjne są przechowywane w Supabase, a operacje wymagające uprawnień administracyjnych są wykonywane po stronie serwera.",
      "W przypadku naruszenia ochrony danych administrator oceni ryzyko i podejmie działania wymagane przez RODO, w tym zgłoszenie naruszenia do UODO lub poinformowanie osób, których dane dotyczą, jeżeli będzie to wymagane.",
    ],
  },
  {
    title: "12. Zmiany polityki prywatności",
    content: [
      "Polityka prywatności może zostać zaktualizowana, jeżeli zmieni się sposób działania sklepu, zakres przetwarzanych danych, dostawcy usług albo wymagania prawne.",
      "Aktualna wersja polityki prywatności jest publikowana na tej stronie.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
        Prywatność
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
        Polityka prywatności
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6d675f]">
        Ten dokument wyjaśnia, jakie dane są przetwarzane w sklepie Pawly,
        dlaczego są potrzebne i jakie prawa przysługują klientowi.
      </p>

      <div className="mt-8 rounded-lg border border-[#f3cbbd] bg-[#fff8f4] p-5 text-sm leading-6 text-[#7a3b24]">
        <strong>Do weryfikacji przed produkcją:</strong> ewentualne informacje o
        dodatkowych narzędziach analitycznych lub marketingowych, jeśli zostaną
        wdrożone.
      </div>

      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <article
            className="rounded-lg border border-[#eee7db] bg-white p-6 shadow-sm"
            key={section.title}
          >
            <h2 className="text-lg font-semibold text-[#1f1f1f]">
              {section.title}
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f5a52]">
              {section.content.map((paragraph, index) => (
                <p key={`${section.title}-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
