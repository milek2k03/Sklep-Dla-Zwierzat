# Pawly

Sklep z akcesoriami dla psów i kotów z panelem administracyjnym. Projekt korzysta z Next.js, Supabase, Stripe i Resend.

## Uruchomienie lokalne

1. Zainstaluj zależności: `npm install`.
2. Skopiuj `.env.example` do `.env.local` i uzupełnij potrzebne zmienne środowiskowe. Nie dodawaj `.env.local` do repozytorium.
3. Uruchom aplikację: `npm run dev`.
4. Otwórz [http://localhost:3000](http://localhost:3000).

Przed wdrożeniem uruchom `npm run quality` (lint, sprawdzenie typów i build).

## Maile promocyjne

Kampania jest domyślnie **wyłączona**. Przed jej włączeniem uruchom w Supabase migracje `029`, `030` i `031` w tej kolejności. Sprawdź również domenę nadawczą w Resend oraz wypisanie się z mailingu.

Ustaw w środowisku produkcyjnym:

| Zmienna | Znaczenie |
| --- | --- |
| `CRON_SECRET` | Sekret chroniący endpoint harmonogramu. |
| `RESEND_API_KEY` | Klucz Resend do wysyłania maili. |
| `STORE_FROM_EMAIL` | Adres nadawcy w zweryfikowanej domenie. |
| `NEXT_PUBLIC_APP_URL` | Publiczny adres sklepu zaczynający się od `https://`. |
| `MARKETING_UNSUBSCRIBE_SECRET` | Losowy sekret o długości co najmniej 32 znaków do podpisywania linków wypisu. |
| `MARKETING_POSTAL_ADDRESS` | Rzeczywisty adres pocztowy nadawcy, wyświetlany w stopce maila. |
| `MARKETING_ENABLED` | Ustaw `true` dopiero po sprawdzeniu treści testowego maila i wypisu. Domyślnie `false`. |

Harmonogram w `vercel.json` wywołuje `/api/cron/marketing` w czwartki o 10:00 UTC, czyli o 11:00 lub 12:00 czasu polskiego. Aplikacja wysyła kampanię **raz na cztery tygodnie**. Wybiera maksymalnie trzy aktywne produkty dostępne w magazynie i wysyła mail tylko na adresy z aktywną zgodą. Każdy adres może otrzymać daną kampanię tylko raz. Nieudane lub niepewne próby wysyłki nie są automatycznie ponawiane, aby uniknąć duplikatów.

Obecny mechanizm zatrzymuje kampanię, jeżeli liczba aktywnych odbiorców przekracza 50. Przed powiększeniem listy należy dodać obsługę większych partii wysyłki. Maile transakcyjne dotyczące zamówień działają niezależnie od kampanii.

## Wdrożenie

Projekt można wdrożyć na Vercel. Ustaw tam zmienne środowiskowe, uruchom migracje Supabase i sprawdź poprawność webhooka Stripe oraz domeny Resend przed rozpoczęciem sprzedaży.
