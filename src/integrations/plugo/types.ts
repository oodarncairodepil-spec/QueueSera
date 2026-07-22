export interface PlugoLocation { id: string; name: string; }
export interface PlugoVariant {
  id: string; sku?: string | null; name: string; size?: string | null; color?: string | null;
  price: number; imageUrl?: string | null;
}
export interface PlugoProduct {
  id: string; name: string; description?: string; imageUrl?: string | null;
  variants: PlugoVariant[];
}
export interface PlugoInventoryItem { variationId: string; productId: string; quantity: number; }
export interface ProductQueryParams { locationId?: string; search?: string; }

export interface PlugoCatalogAdapter {
  listLocations(): Promise<PlugoLocation[]>;
  listProducts(params?: ProductQueryParams): Promise<PlugoProduct[]>;
  getProduct(productId: string): Promise<PlugoProduct>;
  getLocationInventory(locationId: string): Promise<PlugoInventoryItem[]>;
}