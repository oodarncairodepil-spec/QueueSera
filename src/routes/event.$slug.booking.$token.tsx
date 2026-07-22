import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { bookingQueryOptions } from "@/customer/services/queries";
import { supabase } from "@/integrations/supabase/client";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { BookingQR } from "@/customer/components/BookingQR";
import { formatIDR, formatJakarta } from "@/shared/lib/format";
import { MapPin, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/event/$slug/booking/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bookingQueryOptions(params.token)),
  head: () => ({ meta: [{ title: "Your booking — EventQueue" }, { name: "robots", content: "noindex" }] }),
  component: BookingPage,
});

function BookingPage() {
  const { slug, token } = Route.useParams();
  const { data, refetch, isFetching } = useSuspenseQuery(bookingQueryOptions(token));
  const [countdown, setCountdown] = useState<string>("");

  useEffect(() => {
    if (!data?.booking) return;
    const target = new Date(data.booking.expires_at).getTime();
    const tick = () => {
      const ms = target - Date.now();
      if (ms <= 0) { setCountdown("Expired"); return; }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data?.booking?.expires_at]);

  useEffect(() => {
    if (!data?.booking) return;
    const channel = supabase
      .channel(`booking-${data.booking.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${data.booking.id}` }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_tickets", filter: `event_id=eq.${data.booking.event_id}` }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [data?.booking?.id, data?.booking?.event_id, refetch]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <OfflineBanner />
        <main className="mx-auto max-w-md px-4 pt-16 text-center">
          <h1 className="text-2xl">Booking not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This booking may have expired or the link is invalid.</p>
          <Link to="/event/$slug" params={{ slug }} className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">Back to event</Link>
        </main>
      </div>
    );
  }

  const { booking, ahead, nowServing } = data;
  const ev: any = (booking as any).events;
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
  const qrUrl = typeof window !== "undefined" ? `${window.location.origin}/event/${slug}/booking/${token}` : `/event/${slug}/booking/${token}`;

  return (
    <div className="min-h-screen bg-background pb-12">
      <OfflineBanner />
      <main className="mx-auto max-w-md px-4 pt-6">
        <div className={`rounded-2xl p-5 text-center shadow-sm ${emphatic ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border"}`}>
          <div className="text-xs uppercase tracking-wide opacity-80">{statusText[booking.status] ?? booking.status}</div>
          <div className="mt-2 font-display text-6xl leading-none">{booking.queue_number}</div>
          <div className="mt-2 text-xs opacity-80">Booking {booking.booking_number}</div>
          {emphatic && (
            <div className="mt-3 text-sm font-semibold">Show this screen to the cashier now.</div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <BookingQR value={qrUrl} />
          <p className="mt-3 text-center text-xs text-muted-foreground">Show this QR at the cashier or POS scanner.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-card p-3 text-center ring-1 ring-border">
            <div className="text-[11px] uppercase text-muted-foreground">Now serving</div>
            <div className="text-lg font-semibold">{nowServing ?? "—"}</div>
          </div>
          <div className="rounded-xl bg-card p-3 text-center ring-1 ring-border">
            <div className="text-[11px] uppercase text-muted-foreground">Ahead of you</div>
            <div className="text-lg font-semibold">{ahead}</div>
          </div>
          <div className="col-span-2 rounded-xl bg-card p-3 text-center ring-1 ring-border">
            <div className="text-[11px] uppercase text-muted-foreground">Reservation expires in</div>
            <div className="text-lg font-semibold">{countdown}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="mb-2 text-sm font-semibold">Your items</div>
          <ul className="space-y-2 text-sm">
            {(booking as any).booking_items.map((i: any) => (
              <li key={i.id} className="flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate">{i.product_name_snapshot}</div>
                  <div className="text-xs text-muted-foreground">{i.variant_name_snapshot} · {i.quantity}×</div>
                </div>
                <div className="shrink-0 font-medium">{formatIDR(i.subtotal)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Estimated total</span>
            <span>{formatIDR(booking.total_snapshot)}</span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-accent/40 p-4 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{ev?.venue_name}</div>
            {ev?.venue_address && <div className="text-muted-foreground">{ev.venue_address}</div>}
            <div className="mt-1 text-xs text-muted-foreground">Reserved at {formatJakarta(booking.reserved_at)} WIB</div>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh status
        </button>
      </main>
    </div>
  );
}