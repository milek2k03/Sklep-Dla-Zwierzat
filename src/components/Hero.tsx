import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BadgeCheck, Star, Truck } from "lucide-react";

export function Hero() {
  return (
    <section className="relative isolate min-h-[calc(100svh-9rem)] overflow-hidden bg-[#efe7dc]">
      <Image
        src="/images/pawly-hero.jpg"
        alt="Akcesoria Pawly Pet Shop dla psów i kotów do domu, spaceru, auta i podróży"
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[64%_50%]"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(255,253,248,0.98)_0%,rgba(255,253,248,0.9)_30%,rgba(255,253,248,0.46)_58%,rgba(255,253,248,0.08)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-[#fffdf8] to-transparent" />

      <div className="mx-auto flex min-h-[calc(100svh-9rem)] max-w-7xl items-center px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e6dac9] bg-white/72 px-4 py-2 text-sm font-semibold text-[#4d4943] shadow-sm backdrop-blur">
            <BadgeCheck className="h-4 w-4 text-[#b65320]" aria-hidden="true" />
            Dla psa i kota
          </div>

          <h1 className="mt-7 max-w-3xl text-5xl font-semibold leading-[1.04] tracking-tight text-[#171615] sm:text-6xl lg:text-7xl">
            Praktyczne akcesoria dla psów i kotów
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#4f4942] sm:text-xl">
            Starannie wybrane produkty dla pupili — do domu, na spacer, do auta
            i w podróż. Prosto, wygodnie i bez bałaganu.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/produkty"
              className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-7 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(31,31,31,0.18)] transition hover:-translate-y-0.5 hover:bg-[#34302d]"
            >
              Zobacz produkty
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/#bestsellery"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-full border border-[#d7cab9] bg-white/84 px-7 text-sm font-semibold text-[#1f1f1f] shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-[#1f1f1f]"
            >
              Bestsellery
            </Link>
          </div>

          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-white/80 bg-white/74 p-4 shadow-sm backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1e8] text-[#b65320]">
                <Star className="h-5 w-5 fill-[#b65320]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#171615]">4.9/5</p>
                <p className="mt-0.5 text-xs text-[#6d675f]">ocena bestsellerów</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/80 bg-white/74 p-4 shadow-sm backdrop-blur">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f0ed] text-[#35594d]">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#171615]">24h</p>
                <p className="mt-0.5 text-xs text-[#6d675f]">szybka wysyłka</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
