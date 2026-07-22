import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { eventQueryOptions, productsQueryOptions } from "@/customer/services/queries";
import { useCustomerSession } from "@/shared/hooks/useCustomerSession";
import { useCart } from "@/shared/hooks/useCart";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { AvailabilityBadge } from "@/customer/components/AvailabilityBadge";
import { formatIDR } from "@/shared/lib/format";
import { Search, ShoppingBag, Star } from "lucide-react";

export const Route = createFileRoute("/event/$slug/products")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(eventQueryOptions(params.slug));
    await context.queryClient.ensureQueryData(productsQueryOptions(params.slug));
  },
  head: () => ({ meta: [{ title: "Browse products — EventQueue" }] }),
  component: ProductsPage,
});

type SortKey = "featured" | "price_asc" | "price_desc";

function ProductsPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { session, loaded } = useCustomerSession(slug);
  const { data: event } = useSuspenseQuery(eventQueryOptions(slug));
  const { data: products } = useSuspenseQuery(productsQueryOptions(slug));
  const { itemCount } = useCart(slug);

  const [search, setSearch] = useState("");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");

  useEffect(() => {
    if (loaded && !session) navigate({ to: "/event/$slug/access", params: { slug } });
  }, [loaded, session, slug, navigate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (products ?? []).filter((p) => {
      if (showOnlyAvailable && p.availabilityTier === "sold_out") return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "price_asc") list.sort((a, b) => a.startingPrice - b.startingPrice);
    if (sort === "price_desc") list.sort((a, b) => b.startingPrice - a.startingPrice);
    if (sort === "featured") list.sort((a, b) => Number(b.featured) - Number(a.featured));
    return list;
  }, [products, search, showOnlyAvailable, sort]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-2">
            <h1 className="truncate text-xl">{event?.name}</h1>
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
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                aria-label="Search products"
                className="w-full rounded-full border border-input bg-card py-2.5 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort"
              className="rounded-full border border-input bg-card px-3 py-2.5 text-sm"
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price ↑</option>
              <option value="price_desc">Price ↓</option>
            </select>
          </div>
          <label className="mt-2 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--primary)]"
            />
            <span>Only show available</span>
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pt-4">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No products match your filters.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  to="/event/$slug/products/$productId"
                  params={{ slug, productId: p.id }}
                  className="flex h-full flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-border transition-transform active:scale-[0.98]"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-muted">
                    {p.imageUrl && (
                      <img src={p.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    {p.featured && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                        <Star className="h-3 w-3" /> Featured
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <div className="text-sm font-medium leading-snug">{p.name}</div>
                    <div className="text-sm font-semibold">from {formatIDR(p.startingPrice)}</div>
                    <div className="mt-auto pt-1">
                      <AvailabilityBadge tier={p.availabilityTier} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}