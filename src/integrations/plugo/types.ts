export interface PlugoLocation {
  id: string;
  name: string;
}

export interface PlugoVariant {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  /** True when Plugo details provide a human option label (size/color/motif/…). */
  hasOptionLabel: boolean;
  size?: string | null;
  color?: string | null;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
}

export interface PlugoProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  /** Plugo productLabel badge text, if any. */
  productLabel?: string | null;
  /** Plugo productCode (product-level SKU). */
  productCode?: string | null;
  variants: PlugoVariant[];
  /** Percent off from compareAtPrice or percentage promotion, if any. */
  discountPercent?: number | null;
  /** Highest compare-at price across variants, when discounted. */
  compareAtPrice?: number | null;
  /** Units sold across recent orders (best-effort). */
  soldCount?: number;
}


export interface PlugoInventoryItem {
  variationId: string;
  productId: string;
  quantity: number;
}

export interface ProductQueryParams {
  locationId?: string;
  search?: string;
}

export interface PlugoCatalogAdapter {
  listLocations(): Promise<PlugoLocation[]>;
  listProducts(params?: ProductQueryParams): Promise<PlugoProduct[]>;
  getProduct(productId: string): Promise<PlugoProduct>;
  getLocationInventory(locationId: string): Promise<PlugoInventoryItem[]>;
  listSoldCounts?(): Promise<Map<string, number>>;
}

export interface PlugoProductExtras {
  discountPercent: number | null;
  compareAtPrice: number | null;
  soldCount: number;
  imageUrls: string[];
  productLabel: string | null;
  /** Variation ids that have a real option label from Plugo details. */
  labeledVariationIds: string[];
}
