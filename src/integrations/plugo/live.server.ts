import { createHash } from "node:crypto";
import type { PlugoCatalogAdapter, PlugoInventoryItem, PlugoLocation, PlugoProduct, ProductQueryParams } from "./types";

function utcTimestamp(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function signedHeaders(): Record<string, string> {
  const partnerID = process.env.PLUGO_PARTNER_ID!;
  const partnerPASS = process.env.PLUGO_PARTNER_PASS!;
  const vendorID = process.env.PLUGO_VENDOR_ID!;
  const apiKey = process.env.PLUGO_API_KEY!;
  const timeStamp = utcTimestamp();
  const signedKey = createHash("sha256").update(timeStamp + vendorID + partnerPASS + apiKey).digest("hex");
  return { partnerID, partnerPASS, vendorID, timeStamp, signedKey };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.PLUGO_BASE_URL!;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...signedHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Plugo ${path} ${res.status}`);
  return (await res.json()) as T;
}

export function createLivePlugoAdapter(): PlugoCatalogAdapter {
  return {
    listLocations: () => call<PlugoLocation[]>("/partner/locations"),
    listProducts: (params?: ProductQueryParams) =>
      call<PlugoProduct[]>(`/partner/products${params?.locationId ? `?locationId=${params.locationId}` : ""}`),
    getProduct: (id: string) => call<PlugoProduct>(`/partner/products/${id}`),
    getLocationInventory: (locationId: string) => call<PlugoInventoryItem[]>(`/partner/locations/${locationId}/inventory`),
  };
}