export type ProductCategory = string;

export type Product = {
  id: string;
  slug: string;
  name: string;
  price: number;
  purchasePrice?: number;
  compareAtPrice?: number;
  category: ProductCategory;
  rating: number;
  reviewCount: number;
  description: string;
  tag?: string;
  features: string[];
  isActive?: boolean;
  isBundle?: boolean;
  stockQuantity?: number;
  imageUrl?: string;
  imageUrls?: string[];
};
