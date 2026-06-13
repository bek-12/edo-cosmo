/**
 * Shared currency formatter — displays values in Ethiopian Birr (ETB).
 */
export const fmt = (n: number): string =>
  new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("ETB", "Birr");
