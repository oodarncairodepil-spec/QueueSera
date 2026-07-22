import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getAdminBookingById } from "@/customer/services/eventqueue.functions";
import { BookingQR, FullscreenQR } from "@/customer/components/BookingQR";
import { formatIDR, formatJakarta } from "@/shared/lib/format";
import { ArrowLeft, MapPin } from "lucide-react";

const adminBookingQueryOptions = (bookingId: string) =>
  queryOptions({
    queryKey: ["admin", "booking", bookingId],
    queryFn: () => getAdminBookingById({ data: { bookingId } }),
    staleTime: 5_000,
  });

export const Route = createFileRoute("/admin/bookings/$bookingId")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(adminBookingQueryOptions(params.bookingId));
    if (!data) throw notFound();
    return { number: data.booking.booking_number };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.number ?? "Booking"} — Admin` }, { name: "robots", content: "noindex" }],
  }),
  component: AdminBookingDetailPage,
});

type QrFocus = { value: string; title: string; subtitle?: string } | null;

function AdminBookingDetailPage() {
  const { bookingId } = Route.useParams();
  const { data } = useSuspenseQuery(adminBookingQueryOptions(bookingId));
  const [countdown, setCountdown] = useState("");
  const [qrFocus, setQrFocus] = useState<QrFocus>(null);

  useEffect(() => {
    if (!data?.booking) return;
    const target = new Date(data.booking.expires_at).getTime();
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) {
        setCountdown("Expired");
        return;
      }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setCountdown(`${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.booking?.expires_at]);

  if (!data) return null;
  const { booking } = data;
  const ev: any = (booking as any).events;
  const phone = data.phone;
  const statusText: Record<string, string> = {
    reserved: "Booking confirmed",
    queued: "Waiting in queue",
    called: "You are being called",
    at_cashier: "Please go to the cashier",
    processing_at_pos: "Checkout in progress",
    completed: "Purchase completed",
    expired: "Booking expired",
    cancelled: "Booking cancelled",
    no_show: "You were marked as a no-show",
    failed: "Checkout could not be completed",
  };
  const emphatic = booking.status === "called" || booking.status === "at_cashier";
  const qrUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/admin/bookings/${bookingId}`
      : `/admin/bookings/${bookingId}`;

  return (
    <div className="pb-12">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <Link
          to="/admin/bookings"
          aria-label="Back to bookings"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{ev?.name ?? "Booking"}</div>
          {phone && <div className="truncate text-xs text-muted-foreground">{phone}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-6">
        <div
          className={`rounded-2xl p-5 text-center shadow-sm ${
            emphatic ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border"
          }`}
        >
          <div className="text-xs uppercase tracking-wide opacity-80">
            {statusText[booking.status] ?? booking.status}
          </div>
          <div className="mt-2 font-display text-6xl leading-none">{booking.queue_number}</div>
          <div className="mt-2 text-xs opacity-80">Booking {booking.booking_number}</div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-accent/40 p-4 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{ev?.venue_name}</div>
            {ev?.venue_address && <div className="text-muted-foreground">{ev.venue_address}</div>}
            <div className="mt-1 text-xs text-muted-foreground">
              Reserved at {formatJakarta(booking.reserved_at)} WIB
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <BookingQR
            value={qrUrl}
            onClick={() =>
              setQrFocus({ value: qrUrl, title: "Booking QR", subtitle: booking.booking_number })
            }
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">Tap QR to enlarge</p>
        </div>

        <div className="mt-4 rounded-xl bg-card p-3 text-center ring-1 ring-border">
          <div className="text-[11px] uppercase text-muted-foreground">Reservation expires in</div>
          <div className="text-lg font-semibold">{countdown}</div>
        </div>

        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="mb-2 text-sm font-semibold">Items</div>
          <ul className="space-y-3 text-sm">
            {(booking as any).booking_items.map((i: any) => {
              const scanValue = String(i.sku_snapshot || i.plugo_product_id || "").trim();
              return (
                <li key={i.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{i.product_name_snapshot}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.variant_name_snapshot} · {i.quantity}×
                    </div>
                    {scanValue && (
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">ID/SKU: {scanValue}</div>
                    )}
                    <div className="mt-1 font-medium">{formatIDR(i.subtotal)}</div>
                  </div>
                  {scanValue ? (
                    <BookingQR
                      value={scanValue}
                      size={160}
                      alt={`Scan ${scanValue}`}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#fdfaf3] p-1 ring-1 ring-border"
                      onClick={() =>
                        setQrFocus({
                          value: scanValue,
                          title: i.product_name_snapshot,
                          subtitle: scanValue,
                        })
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Estimated total</span>
            <span>{formatIDR(booking.total_snapshot)}</span>
          </div>
        </div>
      </main>

      {qrFocus && (
        <FullscreenQR
          value={qrFocus.value}
          title={qrFocus.title}
          subtitle={qrFocus.subtitle}
          onClose={() => setQrFocus(null)}
        />
      )}
    </div>
  );
}
