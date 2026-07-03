"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/supabase/admin";
import {
  createSupabaseServerClient,
  createSupabaseServiceClient,
} from "@/lib/supabase/server";
import type { ProductCategory } from "@/types/product";
import type { Database } from "@/types/supabase";

type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
const MAX_PRODUCT_IMAGES = 5;
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;

export async function createProductAction(formData: FormData) {
  await requireAdmin();

  const product = await parseProductFormOrRedirect(formData);
  product.sku = product.sku || createProductSku(product.slug);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").insert(product);

  if (error) {
    redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }

  revalidateProductPaths(product.slug);
  redirect("/admin/products?saved=1");
}

export async function updateProductAction(formData: FormData) {
  await requireAdmin();

  const originalSku = getRequiredString(formData, "originalSku").toUpperCase();
  const product = await parseProductFormOrRedirect(formData);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("products")
    .update(product as ProductUpdate)
    .eq("sku", originalSku);

  if (error) {
    redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }

  revalidateProductPaths(product.slug);
  redirect("/admin/products?saved=1");
}

export async function deleteProductAction(formData: FormData) {
  await requireAdmin();

  const sku = getRequiredString(formData, "sku").toUpperCase();
  const supabase = await createSupabaseServerClient();
  const { data: product, error: readError } = await supabase
    .from("products")
    .select("slug")
    .eq("sku", sku)
    .maybeSingle();

  if (readError) {
    redirect(`/admin/products?error=${encodeURIComponent(readError.message)}`);
  }

  const { error } = await supabase.from("products").delete().eq("sku", sku);

  if (error) {
    redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }

  revalidateProductPaths(product?.slug ?? "");
  redirect("/admin/products?saved=1");
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();

  const name = getRequiredString(formData, "categoryName");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("product_categories").insert({ name });

  if (error) {
    redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  }

  revalidateProductPaths("");
  redirect("/admin/products?saved=1");
}

export async function importProductsAction(formData: FormData) {
  await requireAdmin();

  const file = formData.get("productsFile");

  if (!(file instanceof File) || file.size === 0) {
    redirect("/admin/products?error=Nie wybrano pliku CSV.");
  }

  const rows = parseCsv(await file.text());
  const products = rows.map(parseImportedProduct).filter(Boolean) as ProductInsert[];

  if (products.length === 0) {
    redirect("/admin/products?error=Nie znaleziono poprawnych produktów w pliku.");
  }

  const categories = [...new Set(products.map((product) => product.category))];
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("product_categories")
    .upsert(categories.map((name) => ({ name })), { onConflict: "name" });

  const productsWithSku = products.filter((product) => product.sku);
  const productsWithoutSku = products.filter((product) => !product.sku);

  if (productsWithSku.length > 0) {
    const { error } = await supabase
      .from("products")
      .upsert(productsWithSku, { onConflict: "sku" });

    if (error) {
      redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
    }
  }

  if (productsWithoutSku.length > 0) {
    productsWithoutSku.forEach((product) => {
      product.sku = createProductSku(product.slug);
    });

    const { error } = await supabase.from("products").insert(productsWithoutSku);

    if (error) {
      redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidateProductPaths("");
  redirect("/admin/products?saved=1");
}

async function requireAdmin() {
  const adminSession = await getAdminSession();

  if (adminSession.status !== "admin") {
    redirect("/admin/login");
  }
}

async function parseProductForm(formData: FormData): Promise<ProductInsert> {
  const name = getRequiredString(formData, "name");
  const slug = normalizeSlug(getOptionalString(formData, "slug") || name);
  const category = getRequiredString(formData, "category") as ProductCategory;
  const sku = getOptionalString(formData, "sku").toUpperCase();
  const existingImageUrls = getExistingImageUrls(formData);
  const uploadedImageUrls = await uploadProductImages([
    ...formData.getAll("images"),
    ...formData.getAll("image"),
  ]);
  const imageUrls =
    uploadedImageUrls.length > 0 ? uploadedImageUrls : existingImageUrls;

  const product: ProductInsert = {
    ...(sku ? { sku } : {}),
    slug,
    name,
    price: getRequiredNumber(formData, "price"),
    compare_at_price: getOptionalNumber(formData, "compareAtPrice"),
    category,
    rating: getOptionalNumber(formData, "rating") ?? 0,
    review_count: Math.floor(getOptionalNumber(formData, "reviewCount") ?? 0),
    description: getRequiredString(formData, "description"),
    tag: getOptionalString(formData, "tag"),
    features: getFeatures(formData),
    is_active: formData.get("isActive") === "on",
    is_bundle: formData.get("isBundle") === "on",
    stock_quantity: getRequiredInteger(formData, "stockQuantity"),
  };

  if (imageUrls.length > 0) {
    product.image_url = imageUrls[0];
    product.image_urls = imageUrls;
  }

  return product;
}

async function parseProductFormOrRedirect(formData: FormData) {
  try {
    return await parseProductForm(formData);
  } catch (error) {
    redirect(`/admin/products?error=${encodeURIComponent(getErrorMessage(error))}`);
  }
}

function revalidateProductPaths(slug: string) {
  revalidatePath("/");
  revalidatePath("/produkty");
  revalidatePath(`/produkt/${slug}`);
  revalidatePath("/admin/products");
}

async function uploadProductImages(values: FormDataEntryValue[]) {
  const files = values.filter((value): value is File => {
    return value instanceof File && value.size > 0;
  });

  if (files.length === 0) {
    return [];
  }

  if (files.length > MAX_PRODUCT_IMAGES) {
    throw new Error("Możesz wgrać maksymalnie 5 zdjęć produktu.");
  }

  const supabase = createSupabaseServiceClient();
  const imageUrls: string[] = [];

  for (const file of files) {
    const isWebp =
      file.type === "image/webp" || file.name.toLowerCase().endsWith(".webp");

    if (!isWebp) {
      throw new Error("Zdjęcia produktu muszą być w formacie WebP.");
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
      throw new Error("Jedno zdjęcie produktu może mieć maksymalnie 2 MB.");
    }

    const path = `${new Date().getFullYear()}/${globalThis.crypto.randomUUID()}.webp`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, {
        contentType: "image/webp",
        upsert: false,
      });

    if (error) {
      throw new Error(`Nie udało się wgrać zdjęcia: ${error.message}`);
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    imageUrls.push(data.publicUrl);
  }

  return imageUrls;
}

function getExistingImageUrls(formData: FormData) {
  return formData
    .getAll("existingImageUrls")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function parseImportedProduct(row: Record<string, unknown>) {
  const name = getImportedString(row, ["name", "nazwa", "product_name"]);
  const price = getImportedNumber(row, ["price", "cena"]);
  const category = getImportedString(row, ["category", "kategoria", "kolekcja"]);

  if (!name || price === null || !category) {
    return null;
  }

  const sku = getImportedString(row, ["sku", "id"]);
  const slug = normalizeSlug(getImportedString(row, ["slug"]) || name);
  const compareAtPrice = getImportedNumber(row, [
    "compare_at_price",
    "compareAtPrice",
    "cena_przekreslona",
  ]);

  const imageUrl = getImportedString(row, ["image_url", "zdjecie", "image"]) || null;

  return {
    ...(sku ? { sku: sku.toUpperCase() } : {}),
    slug,
    name,
    price,
    compare_at_price: compareAtPrice,
    category,
    rating: getImportedNumber(row, ["rating", "ocena"]) ?? 0,
    review_count: getImportedInteger(row, ["review_count", "opinie"]) ?? 0,
    description: getImportedString(row, ["description", "opis"]) || name,
    tag: getImportedString(row, ["tag", "etykieta"]) || null,
    features: splitFeatures(getImportedString(row, ["features", "cechy"])),
    image_url: imageUrl,
    image_urls: imageUrl ? [imageUrl] : [],
    is_active: getImportedBoolean(row, ["is_active", "aktywny"], true),
    is_bundle: getImportedBoolean(row, ["is_bundle", "zestaw"], false),
    stock_quantity: getImportedInteger(row, ["stock", "stan", "stock_quantity"]) ?? 0,
  } satisfies ProductInsert;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Nieznany błąd.";
}

function getRequiredString(formData: FormData, key: string) {
  const value = getOptionalString(formData, key);

  if (!value) {
    throw new Error(`Pole ${key} jest wymagane.`);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getRequiredNumber(formData: FormData, key: string) {
  const value = getOptionalNumber(formData, key);

  if (value === null) {
    throw new Error(`Pole ${key} musi być liczbą.`);
  }

  return value;
}

function getOptionalNumber(formData: FormData, key: string) {
  const value = getOptionalString(formData, key).replace(",", ".");

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Pole ${key} musi być liczbą.`);
  }

  return Math.round(numberValue * 100) / 100;
}

function getOptionalInteger(formData: FormData, key: string) {
  const value = getOptionalNumber(formData, key);

  return value === null ? null : Math.max(0, Math.floor(value));
}

function getRequiredInteger(formData: FormData, key: string) {
  const value = getOptionalInteger(formData, key);

  if (value === null) {
    throw new Error(`Pole ${key} musi być liczbą całkowitą.`);
  }

  return value;
}

function getFeatures(formData: FormData) {
  return splitFeatures(getOptionalString(formData, "features"));
}

function splitFeatures(value: string) {
  return value
    .split(/\n|;/)
    .map((feature) => feature.trim())
    .filter(Boolean);
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function createProductSku(slug: string) {
  const slugPart = slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  const randomPart = globalThis.crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();

  return `PWL-${slugPart || "PROD"}-${randomPart}`;
}

function getImportedString(row: Record<string, unknown>, keys: string[]) {
  const normalizedRow = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), value]),
  );
  const value = keys
    .map((key) => normalizedRow[key.toLowerCase()])
    .find((candidate) => candidate !== undefined && String(candidate).trim());

  return value === undefined ? "" : String(value).trim();
}

function getImportedNumber(row: Record<string, unknown>, keys: string[]) {
  const value = getImportedString(row, keys).replace(",", ".");

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? Math.round(numberValue * 100) / 100 : null;
}

function getImportedInteger(row: Record<string, unknown>, keys: string[]) {
  const value = getImportedNumber(row, keys);

  return value === null ? null : Math.max(0, Math.floor(value));
}

function getImportedBoolean(
  row: Record<string, unknown>,
  keys: string[],
  fallback: boolean,
) {
  const value = getImportedString(row, keys).toLowerCase();

  if (!value) {
    return fallback;
  }

  return ["1", "true", "tak", "yes", "y"].includes(value);
}

function parseCsv(source: string) {
  const text = source.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (!isQuoted && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!isQuoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((csvRow) =>
    csvRow.some((value) => value.trim()),
  );
  const normalizedHeaders = headers.map((header) => header.trim());

  return dataRows.map((csvRow) =>
    Object.fromEntries(
      normalizedHeaders.map((header, index) => [header, csvRow[index] ?? ""]),
    ),
  );
}

function detectDelimiter(source: string) {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  return semicolonCount > commaCount ? ";" : ",";
}
