import { getPlugoAdapter } from "./index.server";
import { resolvePlugoLocationId, resolvePlugoLocationName } from "./live.server";
import type { PlugoProduct, PlugoProductExtras } from "./types";

/** In-memory extras from the latest Plugo sync, keyed by plugo_product_id. */
const extrasByEvent = new Map<string, Map<string, PlugoProductExtras>>();

const emptyExtras = (): PlugoProductExtras => ({
  discountPercent: null,
  compareAtPrice: null,
  soldCount: 0,
  imageUrls: [],
  productLabel: null,
  labeledVariationIds: [],
});

export function parseProductExtrasNote(note: string | null | undefined): PlugoProductExtras {
  if (!note?.trim()) return emptyExtras();
  try {
    const parsed = JSON.parse(note) as Partial<PlugoProductExtras>;
    return {
      discountPercent:
        typeof parsed.discountPercent === "number" && parsed.discountPercent > 0
          ? parsed.discountPercent
          : null,
      compareAtPrice:
        typeof parsed.compareAtPrice === "number" && parsed.compareAtPrice > 0
          ? parsed.compareAtPrice
          : null,
      soldCount: typeof parsed.soldCount === "number" ? Math.max(0, parsed.soldCount) : 0,
      imageUrls: Array.isArray(parsed.imageUrls)
        ? parsed.imageUrls.filter((u): u is string => typeof u === "string" && Boolean(u))
        : [],
      productLabel: typeof parsed.productLabel === "string" && parsed.productLabel.trim()
        ? parsed.productLabel.trim()
        : null,
      labeledVariationIds: Array.isArray(parsed.labeledVariationIds)
        ? parsed.labeledVariationIds.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return emptyExtras();
  }
}

export function getPlugoProductExtras(
  eventId: string,
  plugoProductId: string,
  eventNote?: string | null,
): PlugoProductExtras {
  return (
    extrasByEvent.get(eventId)?.get(plugoProductId) ??
    parseProductExtrasNote(eventNote) ??
    emptyExtras()
  );
}

function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null;
  return (
    input
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

function assertOk(label: string, error: { message: string } | null) {
  if (error) throw new Error(`[Plugo sync] ${label}: ${error.message}`);
}

function mergeProduct(listProduct: PlugoProduct, detail: PlugoProduct): PlugoProduct {
  return {
    ...detail,
    discountPercent: detail.discountPercent ?? listProduct.discountPercent ?? null,
    compareAtPrice: detail.compareAtPrice ?? listProduct.compareAtPrice ?? null,
    productLabel: detail.productLabel ?? listProduct.productLabel ?? null,
    imageUrls:
      detail.imageUrls?.length ? detail.imageUrls : listProduct.imageUrls?.length ? listProduct.imageUrls : [],
    imageUrl: detail.imageUrl ?? listProduct.imageUrl ?? null,
    soldCount: listProduct.soldCount,
  };
}

/**
 * Pull catalog + Gudang Erspo inventory from Plugo and upsert into local tables.
 * Products with zero Erspo stock are disabled so the catalog only shows sellable items.
 */
export async function syncEventCatalogFromPlugo(eventId: string, plugoLocationId?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const plugo = getPlugoAdapter();
  const locationId = resolvePlugoLocationId(plugoLocationId);
  const locationName = resolvePlugoLocationName();

  const [products, inventory, soldCounts] = await Promise.all([
    plugo.listProducts({ locationId }),
    plugo.getLocationInventory(locationId),
    plugo.listSoldCounts?.().catch(() => new Map<string, number>()) ?? Promise.resolve(new Map()),
  ]);

  const invByVariation = new Map(inventory.map((row) => [row.variationId, row.quantity]));

  // Enrich in-stock products with detail endpoint (variant names/images + full gallery).
  const inStockIds = products
    .filter((product) =>
      product.variants.some((variant) => (invByVariation.get(variant.id) ?? 0) > 0),
    )
    .map((product) => product.id);

  const detailEntries = await Promise.all(
    inStockIds.map(async (id) => {
      try {
        return [id, await plugo.getProduct(id)] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  const detailById = new Map(detailEntries.filter(([, d]) => d != null) as [string, PlugoProduct][]);

  const extras = new Map<string, PlugoProductExtras>();
  const seenProductIds = new Set<string>();
  const seenVariationIds = new Set<string>();
  let inStockCount = 0;

  for (const [index, listProduct] of products.entries()) {
    const product = detailById.has(listProduct.id)
      ? mergeProduct(listProduct, detailById.get(listProduct.id)!)
      : listProduct;

    const erspoStock = product.variants.reduce(
      (sum, variant) => sum + Math.max(0, invByVariation.get(variant.id) ?? 0),
      0,
    );
    const hasStock = erspoStock > 0;
    if (hasStock) inStockCount += 1;

    const imageUrls =
      product.imageUrls?.length
        ? product.imageUrls
        : product.imageUrl
          ? [product.imageUrl]
          : [];

    const productExtras: PlugoProductExtras = {
      discountPercent: product.discountPercent ?? null,
      compareAtPrice: product.compareAtPrice ?? null,
      soldCount: soldCounts.get(product.id) ?? 0,
      imageUrls,
      productLabel: product.productLabel ?? null,
      labeledVariationIds: product.variants.filter((v) => v.hasOptionLabel).map((v) => v.id),
    };

    seenProductIds.add(product.id);
    extras.set(product.id, productExtras);

    const productPayload = {
      event_id: eventId,
      plugo_product_id: product.id,
      display_name: product.name,
      description: stripHtml(product.description),
      image_url: imageUrls[0] ?? product.imageUrl ?? null,
      event_note: JSON.stringify(productExtras),
      enabled: hasStock,
      featured: index < 3 && hasStock,
      display_order: index + 1,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedProduct, error: productError } = await supabaseAdmin
      .from("event_products")
      .upsert(productPayload, { onConflict: "event_id,plugo_product_id" })
      .select("id")
      .single();
    assertOk(`upsert product ${product.id}`, productError);
    const eventProductId = upsertedProduct!.id;

    for (const variant of product.variants) {
      seenVariationIds.add(variant.id);
      const variantQty = invByVariation.get(variant.id) ?? 0;
      const scanCode =
        (variant.barcode ?? "").trim() ||
        (variant.sku ?? "").trim() ||
        (product.productCode ?? "").trim() ||
        product.id;
      const variantPayload = {
        event_product_id: eventProductId,
        plugo_variation_id: variant.id,
        sku: scanCode,
        display_name: variant.hasOptionLabel && variant.name ? variant.name : product.name,
        size: variant.size ?? null,
        color: variant.color ?? null,
        price_snapshot: variant.price,
        image_url_snapshot: variant.imageUrl ?? imageUrls[0] ?? product.imageUrl ?? null,
        enabled: hasStock && variantQty >= 0,
        updated_at: new Date().toISOString(),
      };

      const { error: variantError } = await supabaseAdmin
        .from("event_product_variants")
        .upsert(variantPayload, { onConflict: "event_product_id,plugo_variation_id" });
      assertOk(`upsert variant ${variant.id}`, variantError);

      if (invByVariation.has(variant.id)) {
        const snapPayload = {
          event_id: eventId,
          plugo_location_id: locationId,
          plugo_product_id: product.id,
          plugo_variation_id: variant.id,
          quantity: variantQty,
          synced_at: new Date().toISOString(),
        };
        const { error: snapError } = await supabaseAdmin
          .from("inventory_snapshots")
          .upsert(snapPayload, { onConflict: "event_id,plugo_variation_id" });
        assertOk(`upsert inventory ${variant.id}`, snapError);
      }
    }
  }

  extrasByEvent.set(eventId, extras);

  const { data: localProducts, error: listError } = await supabaseAdmin
    .from("event_products")
    .select("id, plugo_product_id")
    .eq("event_id", eventId);
  assertOk("list local products", listError);

  const disableIds = (localProducts ?? [])
    .filter((row) => !seenProductIds.has(row.plugo_product_id))
    .map((row) => row.id);
  if (disableIds.length) {
    const { error } = await supabaseAdmin
      .from("event_products")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .in("id", disableIds);
    assertOk("disable stale products", error);
  }

  const productIds = (localProducts ?? []).map((p) => p.id);
  if (productIds.length) {
    const { data: localVariants, error: variantListError } = await supabaseAdmin
      .from("event_product_variants")
      .select("id, plugo_variation_id")
      .in("event_product_id", productIds);
    assertOk("list local variants", variantListError);

    const disableVariantIds = (localVariants ?? [])
      .filter((row) => !seenVariationIds.has(row.plugo_variation_id))
      .map((row) => row.id);
    if (disableVariantIds.length) {
      const { error } = await supabaseAdmin
        .from("event_product_variants")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in("id", disableVariantIds);
      assertOk("disable stale variants", error);
    }
  }

  const { error: eventError } = await supabaseAdmin
    .from("events")
    .update({
      plugo_location_id: locationId,
      plugo_location_name: locationName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  assertOk("update event location", eventError);

  return { productCount: products.length, inStockCount, locationId, locationName };
}
