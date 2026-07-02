import Image from "next/image";
import { Car, Home, Package, PawPrint } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { Product } from "@/types/product";
import type { ProductCategory } from "@/types/product";
import { categoryAssets, defaultCategoryAsset } from "@/lib/category-assets";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const categoryIcons: Partial<Record<ProductCategory, IconComponent>> = {
  Spacer: PawPrint,
  Auto: Car,
  Dom: Home,
  Zestawy: Package,
};

type ProductImagePlaceholderProps = {
  product: Product;
  className?: string;
  priorityLabel?: string;
};

export function ProductImagePlaceholder({
  product,
  className,
  priorityLabel,
}: ProductImagePlaceholderProps) {
  const Icon = categoryIcons[product.category] ?? Package;
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
      <div className="absolute left-4 top-4 rounded-full bg-white/82 px-3 py-1 text-xs font-semibold text-[#1f1f1f] shadow-sm backdrop-blur">
        {product.category}
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/84 p-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm",
              asset.accent,
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#1f1f1f]">
              {product.name}
            </p>
            <p className="mt-1 text-xs text-[#6d675f]">Wybrane przez Pawly</p>
          </div>
        </div>
      </div>
    </div>
  );
}
