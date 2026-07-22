import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { bookingQueryOptions } from "@/customer/services/queries";
import { cancelBooking, issueDemoAccessCode } from "@/customer/services/eventqueue.functions";
import { supabase } from "@/integrations/supabase/client";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { BookingQR, FullscreenQR } from "@/customer/components/BookingQR";
import { useLastBooking } from "@/shared/hooks/useCustomerSession";
import { formatIDR, formatJakarta } from "@/shared/lib/format";
import { MapPin, Home } from "lucide-react";

export const Route = createFileRoute("/event/$slug/booking/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bookingQueryOptions(params.token)),
  head: () => ({ meta: [{ title: "Your booking — EventQueue" }, { name: "robots", content: "noindex" }] }),
  component: BookingPage,
});

type QrFocus = { value: string; title: string; subtitle?: string } | null;

function BookingPage() {
  const { slug, token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, refetch } = useSuspenseQuery(bookingQueryOptions(token));
  const { clear: clearLastBooking } = useLastBooking(slug);
  const cancelFn = useServerFn(cancelBooking);
  const issueCodeFn = useServerFn(issueDemoAccessCode);

  const [countdown, setCountdown] = useState<string>("");
  const [showCancel, setShowCancel] = useState(false);
  const [cancelDigits, setCancelDigits] = useState<string[]>(["", "", "", ""]);
  const [cancelDemoCode, setCancelDemoCode] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [issuingCancelCode, setIssuingCancelCode] = useState(false);
  const [qrFocus, setQrFocus] = useState<QrFocus>(null);
  const cancelInputs = useRef<Array<HTMLInputElement | null>>([]);

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

  useEffect(() => {
    if (!data?.booking) return;
    const channel = supabase
      .channel(`booking-${data.booking.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${data.booking.id}` },
        () => refetch(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue_tickets", filter: `event_id=eq.${data.booking.event_id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.booking?.id, data?.booking?.event_id, refetch]);

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <OfflineBanner />
        <main className="mx-auto max-w-md px-4 pt-16 text-center">
          <h1 className="text-2xl">Booking not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This booking may have expired or the link is invalid.</p>
          <Link
            to="/event/$slug"
            params={{ slug }}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Back to event
          </Link>
        </main>
      </div>
    );
  }

  const { booking } = data;
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
  const canCancel = ["reserved", "queued", "called"].includes(booking.status);
  const qrUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/event/${slug}/booking/${token}`
      : `/event/${slug}/booking/${token}`;

  function setCancelDigit(i: number, v: string) {
    const cleaned = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 1);
    setCancelDigits((prev) => {
      const next = [...prev];
      next[i] = cleaned;
      if (cleaned && i < 3) cancelInputs.current[i + 1]?.focus();
      return next;
    });
  }

  async function openCancelModal() {
    setShowCancel(true);
    setCancelError(null);
    setCancelDigits(["", "", "", ""]);
    setCancelDemoCode(null);
    setIssuingCancelCode(true);
    try {
      const res = await issueCodeFn({ data: { slug } });
      if (res.ok && res.code) {
        setCancelDemoCode(res.code);
        setCancelDigits(res.code.split(""));
      } else {
        setCancelError("Could not generate a demo cancel code. Please try again.");
      }
    } catch {
      setCancelError("Could not generate a demo cancel code. Please try again.");
    } finally {
      setIssuingCancelCode(false);
      setTimeout(() => cancelInputs.current[0]?.focus(), 50);
    }
  }

  async function confirmCancel() {
    const code = cancelDigits.join("");
    if (code.length !== 4 || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelFn({ data: { slug, bookingToken: token, code } });
      if (!res.ok) {
        setCancelError(
          res.error === "invalid_code" || res.error === "invalid_format"
            ? "That code doesn't match. Try again."
            : res.error === "not_cancellable"
              ? "This booking can no longer be cancelled."
              : "Cancellation failed. Please try again.",
        );
        setCancelDigits(["", "", "", ""]);
        cancelInputs.current[0]?.focus();
        setCancelling(false);
        return;
      }
      clearLastBooking();
      await queryClient.invalidateQueries({ queryKey: ["booking", token] });
      await refetch();
      setShowCancel(false);
      setCancelling(false);
      navigate({ to: "/event/$slug", params: { slug } });
    } catch {
      setCancelError("Network error. Please try again.");
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <OfflineBanner />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <Link
          to="/event/$slug"
          params={{ slug }}
          aria-label="Back to homepage"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <Home className="h-5 w-5" />
        </Link>
        <div className="truncate px-2 text-sm font-medium">{ev?.name ?? "Booking"}</div>
        <div className="w-11" aria-hidden />
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
          {emphatic && <div className="mt-3 text-sm font-semibold">Show this screen to the cashier now.</div>}
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
              setQrFocus({
                value: qrUrl,
                title: "Booking QR",
                subtitle: booking.booking_number,
              })
            }
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Tap QR to enlarge · Show at the cashier or POS scanner
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-card p-3 text-center ring-1 ring-border">
          <div className="text-[11px] uppercase text-muted-foreground">Reservation expires in</div>
          <div className="text-lg font-semibold">{countdown}</div>
        </div>

        <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border">
          <div className="mb-2 text-sm font-semibold">Your items</div>
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
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-center text-[10px] text-muted-foreground">
                      No ID
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold">
            <span>Estimated total</span>
            <span>{formatIDR(booking.total_snapshot)}</span>
          </div>
        </div>

        {canCancel && (
          <button
            type="button"
            onClick={() => void openCancelModal()}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-semibold text-white"
          >
            Cancel order
          </button>
        )}
      </main>

      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-lg ring-1 ring-border">
            <h2 className="text-lg font-semibold">Confirm cancellation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the 4-character code to cancel this booking and release reserved stock.
            </p>

            <div className="mt-4 rounded-xl bg-accent/50 p-3 ring-1 ring-border">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Temporary demo code
              </div>
              <div className="mt-1 font-mono text-2xl font-bold tracking-[0.2em]">
                {issuingCancelCode ? "····" : cancelDemoCode ?? "————"}
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-3">
              {cancelDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    cancelInputs.current[i] = el;
                  }}
                  value={d}
                  onChange={(e) => setCancelDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !cancelDigits[i] && i > 0) cancelInputs.current[i - 1]?.focus();
                    if (e.key === "Enter" && cancelDigits.join("").length === 4) confirmCancel();
                  }}
                  inputMode="text"
                  autoCapitalize="characters"
                  aria-label={`Cancel code digit ${i + 1}`}
                  maxLength={1}
                  disabled={cancelling || issuingCancelCode}
                  className="h-14 w-12 rounded-xl border-2 border-input bg-card text-center text-xl font-semibold uppercase focus:border-primary focus:outline-none disabled:opacity-50"
                />
              ))}
            </div>
            {cancelError && (
              <div role="alert" className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {cancelError}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={cancelling}
                onClick={() => setShowCancel(false)}
                className="min-h-[44px] flex-1 rounded-xl border border-input bg-card px-4 text-sm font-medium"
              >
                Keep booking
              </button>
              <button
                type="button"
                disabled={cancelling || issuingCancelCode || cancelDigits.join("").length !== 4}
                onClick={confirmCancel}
                className="min-h-[44px] flex-1 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

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
