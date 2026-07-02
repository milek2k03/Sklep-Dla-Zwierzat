import { Check, HeartHandshake, PackageCheck, ShieldCheck } from "lucide-react";
import { BenefitBar } from "@/components/BenefitBar";
import { CategoryShowcase } from "@/components/CategoryShowcase";
import { FeaturedProduct } from "@/components/FeaturedProduct";
import { Hero } from "@/components/Hero";
import { ProductCard } from "@/components/ProductCard";
import { getBestsellerProducts, getFeaturedProduct } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [bestsellerProducts, featuredProduct] = await Promise.all([
    getBestsellerProducts(),
    getFeaturedProduct(),
  ]);

  return (
    <>
      <Hero />
      <BenefitBar />
      <CategoryShowcase />

      <section
        id="bestsellery"
        className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      >
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
              Bestsellery
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
              Najczęściej wybierane
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#6d675f]">
            Produkty, które pomagają uporządkować codzienne spacery, podróże i
            domową rutynę z psem.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bestsellerProducts.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      </section>

      {featuredProduct ? <FeaturedProduct product={featuredProduct} /> : null}

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
            Dlaczego Pawly?
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
            Mniej wyborów, więcej sensu
          </h2>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: Check,
              title: "Praktyczne produkty",
              text: "Wybieramy akcesoria, które realnie ułatwiają codzienność.",
            },
            {
              icon: PackageCheck,
              title: "Proste zestawy",
              text: "Gotowe pakiety pomagają kupić wszystko bez długiego porównywania.",
            },
            {
              icon: ShieldCheck,
              title: "Zakupy bez presji",
              text: "Czytelne ceny, lokalny koszyk i ręczne potwierdzenie zamówienia.",
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-lg border border-[#eee7db] bg-white p-6"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[#1f1f1f]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#6d675f]">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
              <HeartHandshake className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
                Opinie
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1f1f1f]">
                Klienci o Pawly
              </h2>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                quote:
                  "Zestaw spacerowy ma wszystko, czego potrzebujemy na szybkie wyjście.",
                author: "Kasia i Bruno",
              },
              {
                quote:
                  "Sklep jest prosty, przejrzysty i nie trzeba przekopywać się przez setki rzeczy.",
                author: "Michał",
              },
              {
                quote:
                  "Mata pod miski wygląda schludnie, a kuchnia jest dużo łatwiejsza do ogarnięcia.",
                author: "Ania",
              },
            ].map((opinion) => (
              <figure
                key={opinion.author}
                className="rounded-lg border border-[#eee7db] bg-[#fffdf8] p-6"
              >
                <blockquote className="text-base leading-7 text-[#1f1f1f]">
                  „{opinion.quote}”
                </blockquote>
                <figcaption className="mt-4 text-sm font-semibold text-[#6d675f]">
                  {opinion.author}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
