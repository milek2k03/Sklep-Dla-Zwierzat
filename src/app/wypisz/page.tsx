import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/email/marketing";

export const metadata: Metadata = { title: "Wypisz się z wiadomości Pawly", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const { token, done } = await searchParams;
  const valid = token && process.env.MARKETING_UNSUBSCRIBE_SECRET &&
    verifyUnsubscribeToken(token, process.env.MARKETING_UNSUBSCRIBE_SECRET);
  return <main className="mx-auto max-w-lg px-6 py-20 text-[#252525]">
    <h1 className="text-3xl font-semibold">Pawly</h1>
    {done ? <p className="mt-5">Wyłączono wiadomości promocyjne. Nadal możesz otrzymywać informacje dotyczące swoich zamówień.</p>
      : valid ? <><p className="mt-5">Czy wyłączyć wiadomości promocyjne dla adresu {valid.email}?</p>
        <form action={`/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`} method="post">
          <input type="hidden" name="manual" value="1" />
          <button type="submit" className="mt-6 rounded-md bg-[#252525] px-5 py-3 font-semibold text-white">Wypisz mnie</button>
        </form></>
        : <p className="mt-5">Ten link jest nieprawidłowy. Skontaktuj się ze sklepem, aby wyłączyć wiadomości.</p>}
  </main>;
}
