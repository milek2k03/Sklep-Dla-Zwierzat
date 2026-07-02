export const shippingCarrierOptions = [
  { value: "InPost", label: "InPost" },
  { value: "DPD", label: "DPD" },
] as const;

export function normalizeShippingCarrier(value: string) {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.includes("inpost")) {
    return "InPost";
  }

  if (normalizedValue.includes("dpd")) {
    return "DPD";
  }

  return value.trim();
}

export function normalizeTrackingNumber(value: string) {
  return value.trim().replace(/\s+/g, "");
}

export function getTrackingUrl(
  carrier: string | null | undefined,
  trackingNumber: string | null | undefined,
) {
  const normalizedCarrier = normalizeShippingCarrier(carrier ?? "");
  const normalizedTrackingNumber = normalizeTrackingNumber(trackingNumber ?? "");

  if (!normalizedCarrier || !normalizedTrackingNumber) {
    return null;
  }

  if (normalizedCarrier === "InPost") {
    return `https://inpost.pl/sledzenie-przesylek?number=${encodeURIComponent(normalizedTrackingNumber)}`;
  }

  if (normalizedCarrier === "DPD") {
    return `https://tracktrace.dpd.com.pl/parcelDetails?p1=${encodeURIComponent(normalizedTrackingNumber)}`;
  }

  return null;
}

export function normalizeTrackingUrl(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  try {
    const url = new URL(trimmedValue);

    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
