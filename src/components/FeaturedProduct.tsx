import Link from "next/link";
import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/product";

type FeaturedProductProps = {
  product: Product;
};

export function FeaturedProduct({ product }: FeaturedProductProps) {
  return (
    <section className="bg-[#1f1f1f] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1fr] lg:px-8 lg:py-16">
        <div className="relative min-h-[340px] overflow-hidden rounded-lg border border-white/10 bg-[#2a2927] shadow-2xl shadow-black/20">
          <Image
            src="/images/pawly-hero.jpg"
            alt="Zestaw Spacer Premium Pawly"
            fill
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="object-cover object-[68%_50%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-black/4 to-transparent" />
          <div className="absolute bottom-5 left-5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#1f1f1f] backdrop-blur">
            Bestseller Pawly
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-[#ffd9c2]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Główny zestaw
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Zestaw Spacer Premium
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/72">
            Kompletny zestaw na codzienne spacery: praktyczne akcesoria w
            jednym prostym pakiecie.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {product.features.map((feature) => (
              <div key={feature} className="flex items-center gap-3 text-sm">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e86f2c] text-white">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="text-white/82">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-white/55">Cena zestawu</p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="text-3xl font-semibold">
                  {formatPrice(product.price)}
                </span>
                {product.compareAtPrice ? (
                  <span className="text-base text-white/45 line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                ) : null}
              </div>
            </div>
            <AddToCartButton
              product={product}
              className="bg-[#e86f2c] hover:bg-[#cf5f25] sm:ml-auto"
            />
          </div>

          <Link
            href={`/produkt/${product.slug}`}
            className="mt-5 text-sm font-semibold text-[#ffd9c2] transition hover:text-white"
          >
            Zobacz szczegóły produktu
          </Link>
        </div>
      </div>
    </section>
  );
}
