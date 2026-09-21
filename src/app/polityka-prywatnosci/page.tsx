import type { Metadata } from "next";
import { storeBrandName } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Polityka prywatności | ${storeBrandName}`,
};

const ownerName = "Miłosz Czech";
const contactEmail = process.env.ORDER_NOTIFICATION_EMAIL ?? "pawlyassista@gmail.com";
const contactPhone = process.env.STORE_PHONE ?? "+48 531 353 773";
const contactAddress = "ul. Żwirowa 24h, 86-070 Czarże, Polska";

const sections = [
  {
    title: "1. Administrator danych",
    content: [
      `Administratorem danych osobowych klientów i użytkowników sklepu ${storeBrandName} jest ${ownerName}, prowadzący sprzedaż w ramach działalności nierejestrowanej.`,
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
      "Sklep zapisuje także własne zdarzenia konwersji, takie jak wyświetlenie strony, wyświetlenie produktu, dodanie do koszyka, rozpoczęcie checkoutu oraz utworzenie lub opłacenie zamówienia. Zdarzenia mogą zawierać techniczny identyfikator odwiedzającego, identyfikator sesji, adres strony, referrer, dane produktu, kwotę zdarzenia i user-agent.",
    ],
  },
  {
    title: "3. Cele i podstawy prawne przetwarzania",
    content: [
      "Realizacja zamówienia, płatności, dostawy, obsługa statusu zamówienia, zwrotów, reklamacji i wymian: art. 6 ust. 1 lit. b RODO, czyli wykonanie umowy lub działania przed jej zawarciem.",
      "Wypełnianie obowiązków prawnych, w tym obowiązków konsumenckich, podatkowych, księgowych i archiwizacyjnych: art. 6 ust. 1 lit. c RODO.",
      "Kontakt z klientem, dochodzenie lub obrona roszczeń, zapobieganie nadużyciom, prowadzenie historii zdarzeń zamówienia oraz zapewnienie bezpieczeństwa sklepu: art. 6 ust. 1 lit. f RODO, czyli prawnie uzasadniony interes administratora.",
      "Pomiar skuteczności sklepu i poprawa ścieżki zakupowej na podstawie własnych zdarzeń konwersji: art. 6 ust. 1 lit. f RODO, czyli prawnie uzasadniony interes administratora.",
      "Przy składaniu zamówienia można opcjonalnie wyrazić osobną zgodę na e-maile Pawly o produktach i promocjach. Podstawą przetwarzania adresu e-mail w tym celu jest art. 6 ust. 1 lit. a RODO, a kontakt marketingowy wymaga uprzedniej zgody zgodnie z art. 398 Prawa komunikacji elektronicznej. Zgoda nie jest warunkiem zakupu. Obecnie sklep nie wysyła newslettera.",
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
      "Dowód dobrowolnej zgody na e-maile o produktach, obejmujący adres e-mail, datę i treść zgody, przechowujemy do czasu jej wycofania albo ustania celu, a następnie tylko przez okres niezbędny do wykazania zgodności z prawem lub obrony roszczeń.",
      "Dane zwrotów, reklamacji i korespondencji przechowujemy przez okres potrzebny do rozpatrzenia sprawy oraz zabezpieczenia ewentualnych roszczeń.",
      "Dane koszyka zapisane w localStorage pozostają w przeglądarce użytkownika do czasu ich usunięcia przez użytkownika, wyczyszczenia danych przeglądarki albo opróżnienia koszyka.",
      "Identyfikator odwiedzającego używany do własnej analityki konwersji pozostaje w localStorage do czasu usunięcia danych strony w przeglądarce. Identyfikator sesji jest przechowywany w sessionStorage i odnawiany po zakończeniu sesji.",
    ],
  },
  {
    title: "7. Prawa osoby, której dane dotyczą",
    content: [
      "Masz prawo dostępu do swoich danych, otrzymania ich kopii, sprostowania danych, usunięcia danych, ograniczenia przetwarzania, przenoszenia danych, wniesienia sprzeciwu oraz cofnięcia zgody, jeżeli przetwarzanie odbywa się na podstawie zgody.",
      "Nie wszystkie żądania mogą zostać zrealizowane w pełnym zakresie, jeżeli dalsze przechowywanie danych jest wymagane przez przepisy prawa albo potrzebne do ustalenia, dochodzenia lub obrony roszczeń.",
      `Aby skorzystać z praw, napisz na adres: ${contactEmail}.`,
      `Zgodę na wiadomości o produktach można wycofać w każdej chwili, pisząc na adres ${contactEmail}. Po wycofaniu wyłączamy adres z przyszłych wiadomości promocyjnych. Ponowna, wyraźna zgoda przy późniejszym zakupie może je ponownie włączyć. Wycofanie nie wpływa na zgodność wcześniejszego przetwarzania z prawem.`,
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
      "Własna analityka konwersji służy do zbiorczego sprawdzania, które strony i produkty pomagają w zakupie. Nie jest używana do automatycznego ustalania indywidualnych cen ani warunków sprzedaży.",
    ],
  },
  {
    title: "10. Cookies i localStorage",
    content: [
      "Strona może korzystać z technicznych cookies lub podobnych technologii potrzebnych do działania aplikacji, bezpieczeństwa, utrzymania sesji administracyjnej i poprawnego wyświetlania strony.",
      "Koszyk klienta jest zapisywany w localStorage przeglądarki. Dane te są przechowywane lokalnie na urządzeniu użytkownika i mogą zostać usunięte przez wyczyszczenie danych strony w przeglądarce.",
      "Sklep używa własnych identyfikatorów w localStorage i sessionStorage do pomiaru konwersji oraz poprawy działania koszyka i checkoutu.",
      "Obecnie sklep nie wysyła newslettera ani nie korzysta z zewnętrznych pikseli reklamowych opisujących zachowanie klienta w celach reklamowych. Opcjonalne zgody na przyszłe wiadomości o produktach są zapisywane przy zamówieniach.",
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
        Ten dokument wyjaśnia, jakie dane są przetwarzane w sklepie{" "}
        {storeBrandName},
        dlaczego są potrzebne i jakie prawa przysługują klientowi.
      </p>

      <div className="mt-8 rounded-lg border border-[#e9dcc8] bg-[#fffaf2] p-5 text-sm leading-6 text-[#5f5a52]">
        Sklep prowadzi własną techniczną analitykę konwersji, ale nie prowadzi
        obecnie newslettera ani profilowania marketingowego. Zapisuje jedynie
        dobrowolne zgody na przyszłe wiadomości o produktach. Jeżeli zostaną
        wdrożone zewnętrzne narzędzia analityczne lub marketingowe, polityka
        prywatności zostanie zaktualizowana.
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
