import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { eventQueryOptions, productQueryOptions, productsQueryOptions } from "@/customer/services/queries";
import { useCustomerSession } from "@/shared/hooks/useCustomerSession";
import { useCart } from "@/shared/hooks/useCart";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { AvailabilityBadge } from "@/customer/components/AvailabilityBadge";
import { ProductImageSlider } from "@/customer/components/ProductImageSlider";
import { formatIDR, formatSoldCount } from "@/shared/lib/format";
import { Search, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/event/$slug/products/")({
  component: ProductsPage,
});

const PAGE_SIZE = 10;

function ProductsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, loaded } = useCustomerSession(slug);
  const { data: event } = useSuspenseQuery(eventQueryOptions(slug));
  const { data: products } = useSuspenseQuery(productsQueryOptions(slug));
  const { itemCount } = useCart(slug);

  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loaded && (!session || !session.phone)) {
      navigate({ to: "/event/$slug/access", params: { slug } });
    }
  }, [loaded, session, slug, navigate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? [])
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [products, search]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, products]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length, visibleCount]);

  function prefetchProduct(productId: string) {
    void queryClient.prefetchQuery(productQueryOptions(slug, productId));
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="truncate text-xl">{event?.name}</h1>
              <p className="truncate text-xs text-muted-foreground">Stok: Gudang Erspo</p>
            </div>
            <Link
              to="/event/$slug/cart"
              params={{ slug }}
              aria-label={`Cart with ${itemCount} items`}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card ring-1 ring-border"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No products in stock at Gudang Erspo.
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3">
              {visible.map((p) => {
                const showCompare = p.compareAtPrice != null && p.compareAtPrice > p.startingPrice;
                return (
                  <li key={p.id}>
                    <Link
                      to="/event/$slug/products/$productId"
                      params={{ slug, productId: p.id }}
                      preload="intent"
                      onMouseEnter={() => prefetchProduct(p.id)}
                      onTouchStart={() => prefetchProduct(p.id)}
                      className="flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-transform active:scale-[0.98]"
                    >
                      <ProductImageSlider
                        urls={p.imageUrls?.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : []}
                        productLabel={p.productLabel}
                        className="aspect-square w-full"
                        showDots={(p.imageUrls?.length ?? 0) > 1}
                      />
                      <div className="flex flex-1 flex-col gap-1 p-3">
                        <div className="text-sm font-medium leading-snug">{p.name}</div>
                        <div className="flex flex-col gap-0.5">
                          {showCompare && (
                            <span className="text-xs text-muted-foreground line-through">
                              {formatIDR(p.compareAtPrice!)}
                            </span>
                          )}
                          <span className="text-sm font-semibold">from {formatIDR(p.startingPrice)}</span>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                          <AvailabilityBadge tier={p.availabilityTier} />
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatSoldCount(p.soldCount)} Terjual
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {hasMore && (
              <div ref={sentinelRef} className="py-6 text-center text-xs text-muted-foreground">
                Loading more…
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
