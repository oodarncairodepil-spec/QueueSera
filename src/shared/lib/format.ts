export function formatIDR(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "Rp0";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function formatJakarta(dateIso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(dateIso).toLocaleString("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}

export type AvailabilityTier = "available" | "low" | "almost" | "sold_out";

/** Gudang Erspo badges: sold out at 0, low stock under 10. */
export function availabilityTier(qty: number): AvailabilityTier {
  if (qty <= 0) return "sold_out";
  if (qty < 10) return "low";
  return "available";
}

export function availabilityLabel(tier: AvailabilityTier): string {
  return {
    available: "Available",
    low: "Low stock",
    almost: "Low stock",
    sold_out: "Sold out",
  }[tier];
}

export function formatSoldCount(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return Math.round(n).toLocaleString("id-ID");
}
