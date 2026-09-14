export function formatPrice(value: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(value);
}

export function formatPercent(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    style: "percent",
  }).format(value);
}
