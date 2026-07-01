import Link from "next/link";
import { Star } from "lucide-react";
import { AddToCartButton } from "@/components/AddToCartButton";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/product";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-[#eee7db] bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-[#d7cab9] hover:shadow-xl hover:shadow-[#4b3420]/[0.08]">
      <Link href={`/produkt/${product.slug}`} className="block p-3 pb-0">
        <ProductImagePlaceholder product={product} />
      </Link>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#8a8177]">
            {product.category}
          </span>
          {product.tag ? (
            <span className="rounded-full bg-[#fff1e8] px-3 py-1 text-xs font-semibold text-[#b65320] shadow-sm">
              {product.tag}
            </span>
          ) : null}
        </div>

        <Link href={`/produkt/${product.slug}`} className="mt-3 block">
          <h2 className="text-lg font-semibold leading-tight text-[#1f1f1f] transition group-hover:text-[#b65320]">
            {product.name}
          </h2>
        </Link>
        <p className="mt-2 line-clamp-2 min-h-11 text-sm leading-6 text-[#6d675f]">
          {product.description}
        </p>

        <div className="mt-4 flex items-center gap-2 text-sm text-[#6d675f]">
          <Star
            className="h-4 w-4 fill-[#f6b84b] text-[#f6b84b]"
            aria-hidden="true"
          />
          <span className="font-semibold text-[#1f1f1f]">{product.rating}</span>
          <span>({product.reviewCount})</span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-xl font-semibold text-[#1f1f1f]">
            {formatPrice(product.price)}
          </span>
          {product.compareAtPrice ? (
            <span className="text-sm text-[#8a8177] line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          ) : null}
        </div>

        <AddToCartButton product={product} className="mt-5 w-full" />
      </div>
    </article>
  );
}
