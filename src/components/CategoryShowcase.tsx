import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Car, Cat, Dog, Home, Luggage, Package, PawPrint } from "lucide-react";
import { categoryAssets, defaultCategoryAsset } from "@/lib/category-assets";
import type { ProductCategory } from "@/types/product";

const categories: Array<{
  title: ProductCategory;
  description: string;
  href: string;
  icon: typeof PawPrint;
}> = [
  {
    title: "Dla psa",
    description: "Praktyczne rzeczy na spacer, auto i codzienną rutynę psa.",
    href: "/produkty",
    icon: Dog,
  },
  {
    title: "Dla kota",
    description: "Proste akcesoria do spokojnego domu i wygody kota.",
    href: "/produkty",
    icon: Cat,
  },
  {
    title: "Spacer i podróż",
    description: "Miski, organizery i dodatki, które są zawsze pod ręką.",
    href: "/produkty",
    icon: Luggage,
  },
  {
    title: "Auto",
    description: "Akcesoria, które pomagają utrzymać porządek w podróży.",
    href: "/produkty",
    icon: Car,
  },
  {
    title: "Dom",
    description: "Proste produkty do czystszej i spokojniejszej rutyny.",
    href: "/produkty",
    icon: Home,
  },
  {
    title: "Zestawy",
    description: "Gotowe pakiety dla psa, kota albo całej domowej rutyny.",
    href: "/produkty",
    icon: Package,
  },
];

export function CategoryShowcase() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#b65320]">
            Kupuj po potrzebie
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1f1f1f]">
            Spacer, dom, auto i podróż
          </h2>
        </div>
        <Link
          href="/produkty"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#1f1f1f] transition hover:text-[#b65320]"
        >
          Zobacz cały sklep
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const asset = categoryAssets[category.title] ?? defaultCategoryAsset;

          return (
            <Link
              key={category.title}
              href={category.href}
              className="group overflow-hidden rounded-lg border border-[#eee7db] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#d7cab9] hover:shadow-xl hover:shadow-[#4b3420]/[0.08]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#f5efe5]">
                <Image
                  src={asset.src}
                  alt={asset.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  style={{ objectPosition: asset.objectPosition }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#171615]/62 via-[#171615]/8 to-white/6" />
                <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/86 text-[#1f1f1f] shadow-sm backdrop-blur">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-xl font-semibold text-white">
                    {category.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-white/82">
                    {category.description}
                  </p>
                </div>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#1f1f1f] transition group-hover:text-[#b65320]">
                Przeglądaj
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
