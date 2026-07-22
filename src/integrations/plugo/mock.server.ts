import type { PlugoCatalogAdapter, PlugoInventoryItem, PlugoLocation, PlugoProduct, ProductQueryParams } from "./types";

export function createMockPlugoAdapter(): PlugoCatalogAdapter {
  return {
    async listLocations(): Promise<PlugoLocation[]> {
      return [
        { id: "LOC-100", name: "Senayan Park" },
        { id: "LOC-101", name: "Blok M" },
      ];
    },
    async listProducts(_params?: ProductQueryParams): Promise<PlugoProduct[]> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: products } = await supabaseAdmin
        .from("event_products")
        .select("plugo_product_id, display_name, description, image_url, event_product_variants(plugo_variation_id, sku, display_name, size, color, price_snapshot, image_url_snapshot)");
      return (products ?? []).map((p: any) => ({
        id: p.plugo_product_id,
        name: p.display_name,
        description: p.description ?? undefined,
        imageUrl: p.image_url,
        imageUrls: p.image_url ? [p.image_url] : [],
        variants: (p.event_product_variants ?? []).map((v: any) => ({
          id: v.plugo_variation_id,
          sku: v.sku,
          name: v.display_name,
          hasOptionLabel: Boolean(v.size || v.color),
          size: v.size,
          color: v.color,
          price: Number(v.price_snapshot),
          imageUrl: v.image_url_snapshot,
        })),
      }));
    },
    async getProduct(productId: string): Promise<PlugoProduct> {
      const all = await this.listProducts();
      const p = all.find((x) => x.id === productId);
      if (!p) throw new Error("Product not found");
      return p;
    },
    async getLocationInventory(locationId: string): Promise<PlugoInventoryItem[]> {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("inventory_snapshots")
        .select("plugo_product_id, plugo_variation_id, quantity")
        .eq("plugo_location_id", locationId);
      return (data ?? []).map((r: any) => ({
        productId: r.plugo_product_id,
        variationId: r.plugo_variation_id,
        quantity: r.quantity,
      }));
    },
  };
}