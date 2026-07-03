import type { Metadata } from "next";
import { deliveryOptions, FREE_DELIVERY_THRESHOLD } from "@/lib/delivery";
import { formatPrice } from "@/lib/format";
import {
  getReturnAddressLines,
  getReturnShipmentInstructionLines,
} from "@/lib/returns";

export const metadata: Metadata = {
  title: "Regulamin | Pawly",
};

const storeEmail = process.env.ORDER_NOTIFICATION_EMAIL ?? "pawlyassista@gmail.com";
const storePhone = process.env.STORE_PHONE ?? "+48 531 353 773";
const returnAddressLines = getReturnAddressLines();
const sellerName = "Miłosz Czech";
const sellerAddressLines = ["ul. Żwirowa 24", "86-070 Czarże", "Polska"];

const sections = [
  {
    title: "1. Dane sprzedawcy i kontakt",
    content: [
      "Sklep internetowy Pawly działa pod adresem tej strony i prowadzi sprzedaż akcesoriów dla psów i kotów.",
      `Sprzedawca i właściciel sklepu: ${sellerName}.`,
      "Sprzedaż jest prowadzona w ramach działalności nierejestrowanej, o której mowa w art. 5 ustawy Prawo przedsiębiorców, o ile spełnione są warunki ustawowe dla tej formy działalności.",
      `Adres do korespondencji, zwrotów i reklamacji: ${sellerAddressLines.join(", ")}.`,
      `Kontakt e-mail: ${storeEmail}.`,
      `Telefon kontaktowy: ${storePhone}.`,
    ],
  },
  {
    title: "2. Składanie zamówień",
    content: [
      "Zamówienia są składane przez koszyk i formularz zamówienia dostępny w sklepie.",
      "Klient wybiera produkty, ilości, metodę dostawy, podaje dane kontaktowe oraz dane potrzebne do dostawy na terenie Polski.",
      "Przed przejściem do płatności klient widzi podsumowanie koszyka, koszt dostawy, rabat, jeżeli został zastosowany, oraz łączną kwotę do zapłaty.",
      "Zamówienie zostaje zapisane w systemie po przejściu do płatności. Status zamówienia można sprawdzić na stronie Status zamówienia po podaniu numeru zamówienia i adresu e-mail.",
    ],
  },
  {
    title: "3. Ceny, rabaty i dostępność produktów",
    content: [
      "Ceny produktów są podane w złotych polskich i obejmują należne podatki, jeżeli mają zastosowanie.",
      "Sklep może udostępniać kody rabatowe dla całego koszyka, wybranych kategorii albo pojedynczych produktów.",
      "Produkty mają stan magazynowy. System nie powinien pozwolić na zakup większej liczby sztuk niż aktualnie dostępna.",
      "Jeżeli mimo zabezpieczeń produkt okaże się niedostępny, sklep skontaktuje się z klientem w celu anulowania zamówienia, zwrotu płatności albo ustalenia innego rozwiązania.",
    ],
  },
  {
    title: "4. Płatności",
    content: [
      "Płatności online są obsługiwane przez Stripe. Dostępne metody płatności zależą od konfiguracji Stripe i mogą obejmować między innymi kartę, BLIK, PayPal lub inne metody pokazane w oknie płatności.",
      "Sklep nie przechowuje pełnych danych kart płatniczych. Obsługa płatności odbywa się po stronie operatora płatności.",
      "Zamówienie otrzymuje status opłacone po potwierdzeniu płatności przez Stripe.",
      "Zwroty płatności są wykonywane przez Stripe, co do zasady tą samą metodą, którą opłacono zamówienie.",
    ],
  },
  {
    title: "5. Dostawa",
    content: [
      "Dostawa jest realizowana wyłącznie na terenie Polski.",
      `Darmowa dostawa obowiązuje od wartości produktów ${formatPrice(FREE_DELIVERY_THRESHOLD)} po rabatach, jeżeli koszyk spełnia warunki pokazane w sklepie.`,
      "Klient zawsze podaje dane adresowe: miejscowość, ulicę, numer domu lub mieszkania oraz kod pocztowy. Przy dostawie do automatu lub punktu odbioru podaje także kod punktu.",
      "Po nadaniu przesyłki sklep może wysłać klientowi e-mail z przewoźnikiem, numerem śledzenia i linkiem do śledzenia przesyłki.",
      `Aktualne metody dostawy w sklepie: ${deliveryOptions.map((option) => `${option.name} (${formatPrice(option.price)})`).join(", ")}.`,
    ],
  },
  {
    title: "6. Status zamówienia",
    content: [
      "Klient może sprawdzić status zamówienia na stronie Status zamówienia, podając numer zamówienia i adres e-mail użyty przy zakupie.",
      "Na stronie statusu widoczne są informacje o płatności, wysyłce, numerze śledzenia, produktach oraz zgłoszonych zwrotach, reklamacjach lub wymianach.",
      "Dostęp do statusu jest zabezpieczony przez wymaganie zgodności numeru zamówienia i adresu e-mail.",
    ],
  },
  {
    title: "7. Odstąpienie od umowy i zwrot produktów",
    content: [
      "Konsument ma ustawowe prawo odstąpienia od umowy zawartej przez internet w terminie 14 dni od otrzymania rzeczy. Pawly dobrowolnie wydłuża ten termin do 30 dni dla zakupów dokonanych w sklepie.",
      "Aby zgłosić zwrot, klient powinien wejść na stronę Status zamówienia, podać numer zamówienia i e-mail, a następnie wybrać produkty oraz ilości objęte zwrotem.",
      "Zwrot może obejmować całe zamówienie, część zamówienia albo wybrane sztuki danego produktu.",
      "Zwrot płatności za produkty jest wykonywany po otrzymaniu zwracanych produktów albo potwierdzenia ich odesłania, zgodnie z obowiązującymi przepisami.",
      "Przy odstąpieniu od umowy konsument ponosi bezpośrednie koszty odesłania produktów, chyba że sklep wyraźnie zgodził się je ponieść albo nie poinformował o tym obowiązku przed zawarciem umowy.",
      "Przesyłki za pobraniem lub z płatnością po stronie odbiorcy nie będą odbierane.",
    ],
  },
  {
    title: "8. Instrukcja odesłania produktów",
    content: [
      "Po utworzeniu zgłoszenia klient otrzymuje instrukcję odesłania na adres e-mail podany przy zamówieniu. Instrukcja jest widoczna także na stronie statusu zamówienia.",
      ...getReturnShipmentInstructionLines(),
      returnAddressLines.length > 0
        ? `Adres do wysyłki zwrotu lub reklamacji: ${returnAddressLines.join(", ")}.`
        : "Adres do wysyłki zwrotu lub reklamacji zostanie wskazany w wiadomości e-mail oraz na stronie statusu zamówienia.",
    ],
  },
  {
    title: "9. Reklamacje i wymiany",
    content: [
      "Klient ma prawo złożyć reklamację, jeżeli produkt jest niezgodny z umową.",
      "Reklamację lub wymianę można zgłosić przez stronę Status zamówienia, wybierając typ sprawy, produkty, ilości i opis problemu.",
      "Sklep rozpatruje reklamację w terminie 14 dni od jej otrzymania. Brak odpowiedzi w tym terminie oznacza uznanie reklamacji w zakresie przewidzianym przepisami.",
      "W ramach reklamacji sklep może, zależnie od sytuacji i przepisów, zaproponować naprawę, wymianę, obniżenie ceny albo zwrot środków.",
      "Decyzja magazynowa po otrzymaniu paczki określa, czy produkt wraca na magazyn, czy zostaje wyłączony ze sprzedaży.",
    ],
  },
  {
    title: "10. Anulowanie zamówienia i zwroty środków",
    content: [
      "Zamówienie może zostać anulowane przed wysyłką, jeżeli pozwala na to jego status i obsługa zamówienia.",
      "W przypadku anulowania opłaconego zamówienia sklep zleca zwrot płatności przez Stripe.",
      "Przy częściowych zwrotach lub reklamacjach kwota zwrotu dotyczy wybranych produktów. Koszt dostawy jest rozliczany zgodnie z obowiązującymi przepisami i charakterem sprawy.",
      "Czas zaksięgowania zwrotu zależy od operatora płatności, banku lub metody płatności.",
    ],
  },
  {
    title: "11. Dane osobowe",
    content: [
      "Dane klienta są przetwarzane w celu obsługi zamówienia, płatności, dostawy, kontaktu, zwrotów, reklamacji i obowiązków prawnych sprzedawcy.",
      `Administratorem danych osobowych jest ${sellerName}, prowadzący sprzedaż w ramach działalności nierejestrowanej.`,
      "Szczegóły dotyczące przetwarzania danych osobowych powinny znajdować się w Polityce prywatności. Politykę prywatności należy uzupełnić przed uruchomieniem sprzedaży produkcyjnej.",
    ],
  },
  {
    title: "12. Postanowienia końcowe",
    content: [
      "Regulamin obowiązuje od dnia publikacji na stronie sklepu.",
      "Zmiany regulaminu nie naruszają praw nabytych klientów, którzy złożyli zamówienie przed zmianą regulaminu.",
      "W sprawach nieuregulowanych regulaminem stosuje się przepisy prawa polskiego, w szczególności przepisy dotyczące praw konsumenta.",
      "Ten regulamin należy zweryfikować przed sprzedażą produkcyjną oraz po każdej zmianie formy sprzedaży, operatorów usług lub zakresu danych przetwarzanych w sklepie.",
    ],
  },
];

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
        Regulamin
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
        Regulamin sklepu Pawly
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[#6d675f]">
        Dokument opisuje aktualny proces sklepu: koszyk, płatność online,
        dostawę na terenie Polski, status zamówienia oraz obsługę zwrotów,
        reklamacji i wymian.
      </p>

      <div className="mt-8 rounded-lg border border-[#f3cbbd] bg-[#fff8f4] p-5 text-sm leading-6 text-[#7a3b24]">
        <strong>Do weryfikacji przed produkcją:</strong> jeżeli forma sprzedaży
        zmieni się z działalności nierejestrowanej na działalność gospodarczą,
        trzeba będzie uzupełnić dane rejestrowe, np. NIP/REGON.
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
