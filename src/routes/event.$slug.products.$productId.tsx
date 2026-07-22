import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { productQueryOptions } from "@/customer/services/queries";
import { useCustomerSession } from "@/shared/hooks/useCustomerSession";
import { useCart } from "@/shared/hooks/useCart";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { AvailabilityBadge } from "@/customer/components/AvailabilityBadge";
import { ProductImageSlider } from "@/customer/components/ProductImageSlider";
import { ExpandableText } from "@/customer/components/ExpandableText";
import { formatIDR } from "@/shared/lib/format";
import { ArrowLeft, Minus, Plus } from "lucide-react";

export const Route = createFileRoute("/event/$slug/products/$productId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQueryOptions(params.slug, params.productId));
    if (!data) throw notFound();
    return { name: data.name };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? "Product"} — EventQueue` }] }),
  component: ProductPage,
});

function ProductPage() {
  const { slug, productId } = Route.useParams();
  const navigate = useNavigate();
  const { data: product } = useSuspenseQuery(productQueryOptions(slug, productId));
  const { session, loaded } = useCustomerSession(slug);
  const cart = useCart(slug);
  const [selected, setSelected] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (loaded && (!session || !session.phone)) {
      navigate({ to: "/event/$slug/access", params: { slug } });
    }
  }, [loaded, session, slug, navigate]);

  const selectableVariants = useMemo(() => {
    if (!product) return [];
    if (!product.showVariantPicker) return product.variants;
    return product.variants.filter((v) => v.hasOptionLabel);
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const pool = product.showVariantPicker
      ? product.variants.filter((v) => v.hasOptionLabel)
      : product.variants;
    const firstAvailable = pool.find((v) => v.available > 0) ?? pool[0] ?? product.variants[0];
    setSelected(firstAvailable?.id ?? null);
    setQty(1);
  }, [product?.id, product?.showVariantPicker]);

  const galleryUrls = useMemo(() => {
    if (!product) return [];
    if (selected) {
      const variant = product.variants.find((v) => v.id === selected);
      if (variant?.imageUrl) {
        const rest = (product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []).filter(
          (url) => url !== variant.imageUrl,
        );
        return [variant.imageUrl, ...rest];
      }
    }
    return product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : [];
  }, [product, selected]);

  if (!product) return null;
  const variant = product.variants.find((v) => v.id === selected) ?? null;
  const maxAllowed = Math.min(variant?.available ?? 0, product.maxPerCustomer);
  const showCompare =
    product.compareAtPrice != null &&
    variant != null &&
    product.compareAtPrice > variant.price;
  const showPicker = product.showVariantPicker && selectableVariants.length > 0;

  function addToCart() {
    if (!variant || variant.available <= 0) return;
    cart.add({
      variantId: variant.id,
      productId: product!.id,
      productName: product!.name,
      variantName: variant.hasOptionLabel ? variant.name : product!.name,
      sku: variant.sku,
      imageUrl: variant.imageUrl ?? product!.imageUrl,
      unitPrice: variant.price,
      quantity: qty,
    });
    navigate({ to: "/event/$slug/cart", params: { slug } });
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <OfflineBanner />
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <Link
          to="/event/$slug/products"
          params={{ slug }}
          aria-label="Back to products"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="truncate text-base font-medium">{product.name}</h1>
      </header>
      <main className="mx-auto max-w-xl">
        <ProductImageSlider
          urls={galleryUrls}
          productLabel={product.productLabel}
          className="aspect-square w-full"
          intervalMs={galleryUrls.length > 1 ? 3500 : 0}
        />
        <div className="px-4 pt-4">
          <h2 className="text-2xl leading-tight">{product.name}</h2>
          {product.description && <ExpandableText text={product.description} className="mt-2" />}

          {showPicker && (
            <fieldset className="mt-6">
              <legend className="text-sm font-semibold">Select an option</legend>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {selectableVariants.map((v) => {
                  const isSelected = selected === v.id;
                  const disabled = v.available <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelected(v.id);
                        setQty(1);
                      }}
                      className={`flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : disabled
                            ? "border-input bg-muted opacity-60"
                            : "border-input bg-card hover:border-primary/60"
                      }`}
                    >
                      <div className="aspect-square w-full bg-muted">
                        {v.imageUrl ? (
                          <img
                            src={v.imageUrl}
                            alt=""
                            className={`h-full w-full object-cover ${disabled ? "grayscale" : ""}`}
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1 p-2">
                        <span className={`text-xs font-medium leading-snug ${disabled ? "line-through" : ""}`}>
                          {v.name}
                        </span>
                        <AvailabilityBadge tier={v.availabilityTier} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          {variant && variant.available > 0 && (
            <div className="mt-6">
              <div className="text-sm font-semibold">Quantity</div>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-card ring-1 ring-border">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease"
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-base font-semibold" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(maxAllowed, q + 1))}
                  disabled={qty >= maxAllowed}
                  aria-label="Increase"
                  className="flex h-11 w-11 items-center justify-center disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Up to {maxAllowed} per customer (event limit: {product.maxPerCustomer}).
              </p>
            </div>
          )}
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">
              {variant
                ? `${variant.hasOptionLabel ? variant.name : product.name} · ${qty}×`
                : "Select an option"}
            </div>
            {showCompare && (
              <div className="text-xs text-muted-foreground line-through">
                {formatIDR(product.compareAtPrice! * qty)}
              </div>
            )}
            <div className="text-lg font-semibold">{variant ? formatIDR(variant.price * qty) : formatIDR(0)}</div>
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={!variant || variant.available <= 0}
            className="min-h-[52px] flex-1 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-50"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
