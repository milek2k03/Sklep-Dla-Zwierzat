"use client";

import type { InputHTMLAttributes } from "react";

const MAX_PRODUCT_IMAGES = 5;
const MAX_PRODUCT_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_PRODUCT_IMAGES_TOTAL_SIZE =
  MAX_PRODUCT_IMAGES * MAX_PRODUCT_IMAGE_SIZE;

type ProductImageInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "accept" | "multiple" | "onChange"
>;

export function ProductImageInput(props: ProductImageInputProps) {
  return (
    <input
      {...props}
      type="file"
      accept="image/webp,.webp"
      multiple
      onChange={(event) => {
        const input = event.currentTarget;
        const files = Array.from(input.files ?? []);
        const invalidMessage = getInvalidFilesMessage(files);

        if (!invalidMessage) {
          return;
        }

        input.value = "";
        window.alert(invalidMessage);
      }}
    />
  );
}

function getInvalidFilesMessage(files: File[]) {
  if (files.length > MAX_PRODUCT_IMAGES) {
    return "Możesz wybrać maksymalnie 5 zdjęć produktu.";
  }

  const nonWebpFile = files.find((file) => {
    return file.type !== "image/webp" && !file.name.toLowerCase().endsWith(".webp");
  });

  if (nonWebpFile) {
    return "Zdjęcia produktu muszą być w formacie WebP.";
  }

  const tooLargeFile = files.find((file) => file.size > MAX_PRODUCT_IMAGE_SIZE);

  if (tooLargeFile) {
    return "Jedno zdjęcie produktu może mieć maksymalnie 2 MB.";
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > MAX_PRODUCT_IMAGES_TOTAL_SIZE) {
    return "Łączny rozmiar zdjęć produktu może mieć maksymalnie 10 MB.";
  }

  return null;
}
