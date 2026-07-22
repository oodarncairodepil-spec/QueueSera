import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { listAdminBookings } from "@/customer/services/eventqueue.functions";
import { formatIDR, formatJakarta } from "@/shared/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Bookings — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminBookingsPage,
});

const DEMO_SLUG = "summer-market-2026";
const PAGE_SIZE = 20;

function statusClass(status: string) {
  if (status === "cancelled") return "bg-red-100 text-red-700";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "expired" || status === "failed" || status === "no_show") return "bg-amber-100 text-amber-800";
  return "bg-muted text-foreground";
}

function AdminBookingsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isFetching } = useInfiniteQuery({
    queryKey: ["admin", "bookings", DEMO_SLUG, search],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      listAdminBookings({
        data: { slug: DEMO_SLUG, search: search || undefined, offset: pageParam, limit: PAGE_SIZE },
      }),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    refetchInterval: 15_000,
  });

  const bookings = useMemo(() => data?.pages.flatMap((p) => p.bookings) ?? [], [data]);
  const eventName = data?.pages[0]?.event?.name ?? DEMO_SLUG;
  const total = data?.pages[0]?.total;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, bookings.length]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {eventName}
          {typeof total === "number" ? ` · ${total} total` : ""}
          {isFetching && !isFetchingNextPage ? " · refreshing…" : ""}
        </p>
      </div>

      <label className="relative mt-5 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search queue, booking ID, or phone"
          className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading bookings…</p>
      ) : !bookings.length ? (
        <p className="mt-10 text-sm text-muted-foreground">
          {search ? "No bookings match your search." : "No bookings yet."}
        </p>
      ) : (
        <>
          <ul className="mt-6 divide-y divide-border rounded-2xl bg-card ring-1 ring-border">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link
                  to="/admin/bookings/$bookingId"
                  params={{ bookingId: b.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl leading-none">{b.queueNumber}</span>
                      <span className="truncate text-sm font-medium">{b.bookingNumber}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${statusClass(b.status)}`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{formatJakarta(b.reservedAt)} WIB</div>
                    {b.phone && <div className="mt-0.5 text-xs text-muted-foreground">{b.phone}</div>}
                  </div>
                  <div className="shrink-0 text-sm font-semibold">{formatIDR(b.total)}</div>
                </Link>
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} className="h-8" aria-hidden />
          {isFetchingNextPage && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Loading more…</p>
          )}
          {!hasNextPage && bookings.length > 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">End of list</p>
          )}
        </>
      )}
    </main>
  );
}
