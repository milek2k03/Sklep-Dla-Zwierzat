import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, RotateCcw, Star, Truck } from "lucide-react";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { ProductPurchaseControls } from "@/components/ProductPurchaseControls";
import { ProductViewTracker } from "@/components/ProductViewTracker";
import { storeBrandName } from "@/lib/brand";
import { formatPrice } from "@/lib/format";
import { getStockLabel } from "@/lib/inventory";
import {
  getPublishedProductBySlug,
  products,
} from "@/lib/products";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return products.map((product) => ({
    slug: product.slug,
  }));
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) {
    return {
      title: `Produkt | ${storeBrandName}`,
    };
  }

  const productImage = product.imageUrls?.[0] ?? product.imageUrl;
  const productTitle = `${product.name} | ${storeBrandName}`;

  return {
    title: productTitle,
    description: product.description,
    alternates: {
      canonical: `/produkt/${product.slug}`,
    },
    openGraph: {
      title: productTitle,
      description: product.description,
      url: `/produkt/${product.slug}`,
      siteName: storeBrandName,
      locale: "pl_PL",
      type: "website",
      images: productImage
        ? [
            {
              url: productImage,
              alt: product.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: productTitle,
      description: product.description,
      images: productImage ? [productImage] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublishedProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const stockLabel = getStockLabel(product);
  const galleryImages =
    product.imageUrls?.slice(0, 5) ?? (product.imageUrl ? [product.imageUrl] : []);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <ProductViewTracker
        product={{
          slug: product.slug,
          name: product.name,
          category: product.category,
          price: product.price,
        }}
      />
      <Link
        href="/produkty"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#5f5a52] transition hover:text-[#1f1f1f]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Wróć do produktów
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[0.95fr_1fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <ProductImagePlaceholder product={product} />
          {galleryImages.length > 0 ? (
            <div
              className="mt-3 grid grid-cols-5 gap-2"
              aria-label="Galeria zdjęć produktu"
            >
              {galleryImages.map((imageUrl, index) => (
                <div
                  key={`${imageUrl}-${index}`}
                  className="relative aspect-square overflow-hidden rounded-lg border border-[#eee7db] bg-[#f7f1e8] first:border-[#1f1f1f] first:shadow-sm"
                >
                  <Image
                    src={imageUrl}
                    alt={`${product.name} - zdjęcie ${index + 1}`}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-5 rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#1f1f1f]">Opis</h2>
            <p className="mt-2 text-sm leading-7 text-[#5f5a52]">
              {product.description}
            </p>
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#f5efe5] px-4 py-2 text-sm font-semibold text-[#b65320]">
              {product.category}
            </span>
            <span className="rounded-full border border-[#eee7db] bg-white px-4 py-2 text-sm font-semibold text-[#6d675f]">
              ID: {product.id}
            </span>
            {product.tag ? (
              <span className="rounded-full bg-[#fff1e8] px-4 py-2 text-sm font-semibold text-[#b65320]">
                {product.tag}
              </span>
            ) : null}
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#1f1f1f] sm:text-5xl">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-2 text-sm text-[#6d675f]">
            <Star
              className="h-4 w-4 fill-[#f6b84b] text-[#f6b84b]"
              aria-hidden="true"
            />
            <span className="font-semibold text-[#1f1f1f]">
              {product.rating}
            </span>
            <span>({product.reviewCount} opinii)</span>
          </div>

          <div className="mt-7 flex items-baseline gap-3">
            <span className="text-4xl font-semibold text-[#1f1f1f]">
              {formatPrice(product.price)}
            </span>
            {product.compareAtPrice ? (
              <span className="text-lg text-[#8a8177] line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            ) : null}
          </div>
          {stockLabel ? (
            <p className="mt-3 text-sm font-semibold text-[#b65320]">
              {stockLabel}
            </p>
          ) : null}

          <div className="mt-8 rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm">
            <ProductPurchaseControls product={product} />
          </div>

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#1f1f1f]">
              Co zyskujesz
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {product.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f5efe5] text-[#b65320]">
                    <Check className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-[#5f5a52]">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#eee7db] bg-white p-5">
              <Truck className="h-5 w-5 text-[#b65320]" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-[#1f1f1f]">
                Dostawa
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d675f]">
                Wysyłka 24h dla dostępnych produktów. Darmowa dostawa od 199 zł.
              </p>
            </div>
            <div className="rounded-lg border border-[#eee7db] bg-white p-5">
              <RotateCcw className="h-5 w-5 text-[#b65320]" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-[#1f1f1f]">
                Zwrot
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d675f]">
                Masz 14 dni na odstąpienie od umowy. Zgłoszenie zrobisz przez
                status zamówienia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
