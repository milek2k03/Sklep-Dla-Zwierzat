export type ProductCategory = "Spacer" | "Auto" | "Dom" | "Zestawy";

export type Product = {
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: ProductCategory;
  rating: number;
  reviewCount: number;
  description: string;
  tag?: string;
  features: string[];
};
