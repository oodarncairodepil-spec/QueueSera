import { createHash } from "node:crypto";
import type {
  PlugoCatalogAdapter,
  PlugoInventoryItem,
  PlugoLocation,
  PlugoProduct,
  PlugoVariant,
  ProductQueryParams,
} from "./types";

type PlugoApiList<T> = { data?: T[]; requestId?: string; total?: number };
type PlugoApiItem<T> = { data?: T; requestId?: string };

type RawPromotion = {
  name?: string;
  promotionType?: string;
  discount?: number;
  use?: boolean;
};

type RawVariation = {
  id: number | string;
  price?: number;
  compareAtPrice?: number | null;
  /** Sometimes used by merchants as the higher “display” / strikethrough price. */
  costPerItem?: number | null;
  sku?: string | null;
  barcode?: string | null;
  isActive?: boolean;
  details?: Array<{ key?: string; value?: string; imageURL?: string }>;
  inventories?: Array<{ quantity?: number; location?: { id?: number | string } }>;
};

type RawProduct = {
  id: number | string;
  name: string;
  description?: string | null;
  available?: boolean;
  productLabel?: string | null;
  productCode?: string | null;
  images?: Array<{ url?: string }>;
  productVariations?: RawVariation[];
  promotion?: RawPromotion | null;
};

type RawLocation = { id: number | string; name: string; active?: boolean };
type RawInventory = {
  quantity?: number;
  productVariation?: { id?: number | string };
  location?: { id?: number | string };
};

type RawOrder = {
  productVariationOrders?: Array<{
    quantity?: number;
    productVariation?: { id?: number | string; product?: { id?: number | string } };
    productInfo?: string;
  }>;
};

function env(name: string, ...aliases: string[]): string {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  throw new Error(`Missing Plugo env: ${name}`);
}

function utcTimestamp(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function signedHeaders(): Record<string, string> {
  const partnerID = env("PLUGO_PARTNER_ID", "PARTNER_ID");
  const partnerPASS = env("PLUGO_PARTNER_PASS", "PARTNER_PASS");
  const vendorID = env("PLUGO_VENDOR_ID", "VENDOR_ID");
  const apiKey = env("PLUGO_API_KEY", "API_KEY");
  const timeStamp = utcTimestamp();
  const signedKey = createHash("sha256")
    .update(timeStamp + vendorID + partnerPASS + apiKey)
    .digest("hex");
  return { partnerID, partnerPASS, vendorID, timeStamp, signedKey };
}

function baseUrl(): string {
  return (process.env.PLUGO_BASE_URL || "https://faas.plugo.world/partner").replace(/\/$/, "");
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...signedHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Plugo ${path} ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as T;
}

function detailValue(details: RawVariation["details"], key: string): string | null {
  const hit = (details ?? []).find((d) => (d.key ?? "").toLowerCase() === key.toLowerCase());
  return hit?.value ?? null;
}

function discountFromCompare(price: number, compareAt?: number | null): number | null {
  if (!compareAt || !(compareAt > price) || price < 0) return null;
  return Math.max(1, Math.round((1 - price / compareAt) * 100));
}

function discountFromPromotion(promotion?: RawPromotion | null): number | null {
  if (!promotion || promotion.use === false) return null;
  const type = (promotion.promotionType ?? "").toLowerCase();
  const value = Number(promotion.discount ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (type.includes("percentage")) return Math.round(value);
  return null;
}

function variantDisplayName(details: RawVariation["details"]): { name: string; hasOptionLabel: boolean } {
  const parts = (details ?? [])
    .map((d) => (d.value ?? "").trim())
    .filter(Boolean);
  if (parts.length) return { name: parts.join(" / "), hasOptionLabel: true };
  return { name: "", hasOptionLabel: false };
}

function resolveCompareAtPrice(price: number, compareAt?: number | null): number | null {
  if (compareAt != null && Number(compareAt) > price) return Number(compareAt);
  return null;
}

function mapVariant(v: RawVariation): PlugoVariant {
  const size = detailValue(v.details, "Size") ?? detailValue(v.details, "size");
  const color = detailValue(v.details, "Color") ?? detailValue(v.details, "color");
  const imageFromDetail = (v.details ?? []).find((d) => d.imageURL)?.imageURL ?? null;
  const price = Number(v.price ?? 0);
  const { name, hasOptionLabel } = variantDisplayName(v.details);
  const sku = (v.sku ?? "").trim() || null;
  const barcode = (v.barcode ?? "").trim() || null;
  return {
    id: String(v.id),
    sku,
    barcode,
    name,
    hasOptionLabel,
    size,
    color,
    price,
    compareAtPrice: resolveCompareAtPrice(price, v.compareAtPrice),
    imageUrl: imageFromDetail,
  };
}

function mapProduct(p: RawProduct): PlugoProduct {
  const variants = (p.productVariations ?? [])
    .filter((v) => v.isActive !== false)
    .map(mapVariant);

  const imageUrls = (p.images ?? [])
    .map((img) => img.url)
    .filter((url): url is string => Boolean(url));

  let discountPercent = discountFromPromotion(p.promotion);
  let compareAtPrice: number | null = null;
  for (const v of variants) {
    const fromCompare = discountFromCompare(v.price, v.compareAtPrice);
    if (fromCompare != null) {
      discountPercent = Math.max(discountPercent ?? 0, fromCompare);
    }
    if (v.compareAtPrice != null && v.compareAtPrice > v.price) {
      compareAtPrice = Math.max(compareAtPrice ?? 0, v.compareAtPrice);
    }
  }

  const productLabel = (p.productLabel ?? "").trim() || null;
  const productCode = (p.productCode ?? "").trim() || null;

  return {
    id: String(p.id),
    name: p.name,
    description: p.description ?? undefined,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    productLabel,
    productCode,
    variants,
    discountPercent: discountPercent && discountPercent > 0 ? discountPercent : null,
    compareAtPrice,
  };
}

async function fetchAllPages<T>(path: string, pageSizeHint = 50): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const sep = path.includes("?") ? "&" : "?";
    const json = await call<PlugoApiList<T>>(`${path}${sep}offset=${offset}`);
    const batch = json.data ?? [];
    rows.push(...batch);
    if (batch.length === 0 || batch.length < pageSizeHint) break;
    offset += batch.length;
    if (offset > 2000) break;
  }
  return rows;
}

export function createLivePlugoAdapter(): PlugoCatalogAdapter {
  return {
    async listLocations(): Promise<PlugoLocation[]> {
      const json = await call<PlugoApiList<RawLocation>>("/v1/locations");
      return (json.data ?? [])
        .filter((l) => l.active !== false)
        .map((l) => ({ id: String(l.id), name: l.name }));
    },

    async listProducts(_params?: ProductQueryParams): Promise<PlugoProduct[]> {
      const json = await call<PlugoApiList<RawProduct>>("/v1/products");
      return (json.data ?? [])
        .filter((p) => p.available !== false)
        .map(mapProduct)
        .filter((p) => p.variants.length > 0);
    },

    async getProduct(productId: string): Promise<PlugoProduct> {
      const json = await call<PlugoApiItem<RawProduct>>(`/v1/products/${encodeURIComponent(productId)}`);
      if (!json.data) throw new Error(`Plugo product ${productId} not found`);
      return mapProduct(json.data);
    },

    async getLocationInventory(locationId: string): Promise<PlugoInventoryItem[]> {
      const rows = await fetchAllPages<RawInventory>(
        `/v1/locations/${encodeURIComponent(locationId)}/inventories`,
      );
      return rows
        .filter((row) => row.productVariation?.id != null)
        .map((row) => ({
          variationId: String(row.productVariation!.id),
          productId: "",
          quantity: Number(row.quantity ?? 0),
        }));
    },

    async listSoldCounts(): Promise<Map<string, number>> {
      const sold = new Map<string, number>();
      const orders = await fetchAllPages<RawOrder>("/v1/orders", 50);
      for (const order of orders) {
        for (const line of order.productVariationOrders ?? []) {
          const qty = Number(line.quantity ?? 0);
          if (!Number.isFinite(qty) || qty <= 0) continue;
          let productId = line.productVariation?.product?.id != null
            ? String(line.productVariation.product.id)
            : "";
          if (!productId && line.productInfo) {
            try {
              const info = JSON.parse(line.productInfo) as { productId?: number | string };
              if (info.productId != null) productId = String(info.productId);
            } catch {
              /* ignore malformed productInfo */
            }
          }
          if (!productId) continue;
          sold.set(productId, (sold.get(productId) ?? 0) + qty);
        }
      }
      return sold;
    },
  };
}

/** Gudang Erspo default location for this vendor. */
export const PLUGO_ERSPO_LOCATION_ID = "6603";
export const PLUGO_ERSPO_LOCATION_NAME = "Gudang Erspo";

export function resolvePlugoLocationId(eventLocationId?: string | null): string {
  const fromEnv = process.env.PLUGO_LOCATION_ID?.trim();
  if (fromEnv) return fromEnv;
  if (eventLocationId && /^\d+$/.test(eventLocationId)) return eventLocationId;
  return PLUGO_ERSPO_LOCATION_ID;
}

export function resolvePlugoLocationName(): string {
  return process.env.PLUGO_LOCATION_NAME?.trim() || PLUGO_ERSPO_LOCATION_NAME;
}
