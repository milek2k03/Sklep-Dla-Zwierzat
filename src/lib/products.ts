import type { Product, ProductCategory } from "@/types/product";

export const productCategories: Array<"Wszystkie" | ProductCategory> = [
  "Wszystkie",
  "Spacer",
  "Auto",
  "Dom",
  "Zestawy",
];

export const products: Product[] = [
  {
    slug: "zestaw-spacer-premium",
    name: "Zestaw Spacer Premium",
    price: 129.99,
    compareAtPrice: 169.99,
    category: "Zestawy",
    rating: 4.9,
    reviewCount: 128,
    description: "Kompletny zestaw na codzienne spacery z psem.",
    tag: "Bestseller",
    features: [
      "saszetka na smaczki",
      "składana miska",
      "etui na woreczki",
      "wygoda na każdy spacer",
    ],
  },
  {
    slug: "zestaw-czyste-auto",
    name: "Zestaw Czyste Auto",
    price: 149.99,
    category: "Auto",
    rating: 4.8,
    reviewCount: 96,
    description: "Zestaw dla osób, które podróżują z psem samochodem.",
    features: [
      "pokrowiec do auta",
      "mniej sierści na siedzeniach",
      "łatwiejsze sprzątanie",
    ],
  },
  {
    slug: "saszetka-na-smaczki",
    name: "Saszetka na smaczki",
    price: 49.99,
    category: "Spacer",
    rating: 4.8,
    reviewCount: 112,
    description: "Praktyczna saszetka na przysmaki podczas spaceru i treningu.",
    features: [
      "lekka i wygodna",
      "szybki dostęp do nagród",
      "sprawdza się na treningu",
    ],
  },
  {
    slug: "etui-na-woreczki",
    name: "Etui na woreczki",
    price: 29.99,
    category: "Spacer",
    rating: 4.7,
    reviewCount: 89,
    description: "Małe etui, które przypniesz do smyczy lub torby.",
    features: [
      "kompaktowy format",
      "łatwe przypięcie",
      "woreczki zawsze pod ręką",
    ],
  },
  {
    slug: "skladana-miska-silikonowa",
    name: "Składana miska silikonowa",
    price: 39.99,
    category: "Spacer",
    rating: 4.9,
    reviewCount: 74,
    description: "Lekka miska na wodę lub karmę w podróży.",
    features: [
      "składana konstrukcja",
      "łatwa do opłukania",
      "dobra na dłuższe spacery",
    ],
  },
  {
    slug: "mata-pod-miski",
    name: "Mata pod miski",
    price: 59.99,
    category: "Dom",
    rating: 4.8,
    reviewCount: 64,
    description: "Pomaga utrzymać porządek przy miskach psa.",
    features: [
      "chroni podloge",
      "łatwe czyszczenie",
      "minimalistyczny wygląd",
    ],
  },
  {
    slug: "recznik-z-mikrofibry",
    name: "Ręcznik z mikrofibry",
    price: 39.99,
    category: "Dom",
    rating: 4.6,
    reviewCount: 57,
    description: "Przydatny po spacerze, deszczu lub kąpieli.",
    features: [
      "szybko chlonie wilgoc",
      "miękki dla sierści",
      "zajmuje mało miejsca",
    ],
  },
  {
    slug: "bandana-dla-psa",
    name: "Bandana dla psa",
    price: 24.99,
    category: "Spacer",
    rating: 4.7,
    reviewCount: 46,
    description: "Prosty dodatek dla psa, dobry do zdjęć i spacerów.",
    features: [
      "lekki materiał",
      "prosty sposób zapięcia",
      "subtelny spacerowy dodatek",
    ],
  },
];

export const bestsellerProducts = products.slice(0, 6);

export const featuredProduct =
  products.find((product) => product.slug === "zestaw-spacer-premium") ?? products[0];

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}
