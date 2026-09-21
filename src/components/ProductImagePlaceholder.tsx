import Image from "next/image";
import type { Product } from "@/types/product";
import { categoryAssets, defaultCategoryAsset } from "@/lib/category-assets";
import { cn } from "@/lib/utils";

type ProductImagePlaceholderProps = {
  product: Product;
  className?: string;
  priorityLabel?: string;
  showCategoryBadge?: boolean;
};

export function ProductImagePlaceholder({
  product,
  className,
  priorityLabel,
  showCategoryBadge = true,
}: ProductImagePlaceholderProps) {
  const asset = categoryAssets[product.category] ?? defaultCategoryAsset;

  return (
    <div
      className={cn(
        "relative flex aspect-[4/3] overflow-hidden rounded-lg border border-white/70 bg-[#f5efe5] shadow-inner",
        className,
      )}
      aria-label={priorityLabel ?? `Zdjęcie produktu ${product.name}`}
      role="img"
    >
      <Image
        src={product.imageUrl || asset.src}
        alt=""
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
        style={{ objectPosition: asset.objectPosition }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#171615]/45 via-transparent to-white/12" />
      {showCategoryBadge ? (
        <div className="absolute left-4 top-4 rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-[#1f1f1f] shadow-sm backdrop-blur">
          {product.category}
        </div>
      ) : null}
    </div>
  );
}
