export const DELIVERY_COUNTRY = "Polska";

type AddressParts = {
  street?: string;
  buildingNumber?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

export function normalizePolishPostalCode(value: string) {
  const compactValue = value.trim().replace(/\s+/g, "");

  if (/^\d{5}$/.test(compactValue)) {
    return `${compactValue.slice(0, 2)}-${compactValue.slice(2)}`;
  }

  return compactValue;
}

export function isPolishPostalCode(value: string) {
  return /^\d{2}-\d{3}$/.test(normalizePolishPostalCode(value));
}

export function formatDeliveryAddress({
  street,
  buildingNumber,
  postalCode,
  city,
  country = DELIVERY_COUNTRY,
}: AddressParts) {
  const normalizedPostalCode = postalCode
    ? normalizePolishPostalCode(postalCode)
    : "";
  const streetLine = [street?.trim(), buildingNumber?.trim()]
    .filter(Boolean)
    .join(" ");
  const cityLine = [normalizedPostalCode, city?.trim()]
    .filter(Boolean)
    .join(" ");

  return [streetLine, cityLine, country].filter(Boolean).join("\n");
}
