import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { eventQueryOptions } from "@/customer/services/queries";
import { formatJakarta } from "@/shared/lib/format";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { BookingQR } from "@/customer/components/BookingQR";
import { useCustomerSession, useLastBooking } from "@/shared/hooks/useCustomerSession";
import { ArrowRight, Clock, MapPin } from "lucide-react";

export const Route = createFileRoute("/event/$slug/")({
  component: EventLanding,
});

function EventLanding() {
  const { slug } = Route.useParams();
  const { data: event } = useSuspenseQuery(eventQueryOptions(slug));
  const { token: bookingToken } = useLastBooking(slug);
  const { session } = useCustomerSession(slug);

  if (!event) return null;
  const now = Date.now();
  const openAt = new Date(event.reservation_open_at).getTime();
  const closeAt = new Date(event.reservation_close_at).getTime();
  const stateBanner = (() => {
    if (event.status === "paused")
      return { tone: "warn" as const, text: "Reservations are temporarily paused by the event organizer." };
    if (event.status === "closed" || event.status === "completed")
      return { tone: "muted" as const, text: "Reservations for this event are closed." };
    if (event.status === "cancelled")
      return { tone: "warn" as const, text: "This event has been cancelled." };
    if (now < openAt)
      return {
        tone: "muted" as const,
        text: `Reservations have not opened yet. Opens ${formatJakarta(event.reservation_open_at)}.`,
      };
    if (now > closeAt) return { tone: "muted" as const, text: "Reservations for this event are closed." };
    return null;
  })();
  const canReserve = event.status === "active" && !stateBanner;
  const seller = (event as { seller?: { name: string; logo_url: string | null } }).seller;

  return (
    <div className="min-h-screen bg-background pb-24">
      <OfflineBanner />
      {event.banner_url && (
        <div className="relative h-52 w-full overflow-hidden sm:h-64">
          <img
            src={event.banner_url}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background" />
        </div>
      )}

      <main className="relative z-10 mx-auto -mt-14 max-w-xl px-4">
        <section className="rounded-2xl bg-card p-5 text-card-foreground shadow-md ring-1 ring-border">
          {seller?.logo_url && (
            <div className="mb-4 flex items-center gap-3">
              <img
                src={seller.logo_url}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
              />
              <span className="text-sm font-medium text-muted-foreground">{seller.name}</span>
            </div>
          )}

          <h1 className="font-display text-3xl leading-tight text-foreground sm:text-4xl">
            {event.name}
          </h1>
          {event.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{event.description}</p>
          )}

          <dl className="mt-6 space-y-4 border-t border-border pt-5 text-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <MapPin className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Venue
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">{event.venue_name}</dd>
                {event.venue_address && (
                  <dd className="mt-0.5 text-muted-foreground">{event.venue_address}</dd>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-foreground/70" />
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  When
                </dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {formatJakarta(event.event_start_at, { weekday: "short", day: "2-digit", month: "short" })}
                  {" — "}
                  {formatJakarta(event.event_end_at, { weekday: "short", day: "2-digit", month: "short" })}
                </dd>
                <dd className="mt-0.5 text-muted-foreground">
                  Reservations {formatJakarta(event.reservation_open_at)} –{" "}
                  {formatJakarta(event.reservation_close_at)} WIB
                </dd>
              </div>
            </div>
          </dl>

          {stateBanner && (
            <div
              className={`mt-5 rounded-lg p-3 text-sm ${
                stateBanner.tone === "warn" ? "bg-warning/20 text-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {stateBanner.text}
            </div>
          )}
        </section>

        {bookingToken && (
          <Link
            to="/event/$slug/booking/$token"
            params={{ slug, token: bookingToken }}
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent p-4 text-accent-foreground ring-1 ring-border"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide">You have a booking</div>
              <div className="text-sm">Tap to view your queue number</div>
            </div>
            <BookingQR
              value={
                typeof window !== "undefined"
                  ? `${window.location.origin}/event/${slug}/booking/${bookingToken}`
                  : `/event/${slug}/booking/${bookingToken}`
              }
              size={128}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#fdfaf3] p-1 ring-1 ring-border"
            />
          </Link>
        )}

        <div className="mt-6">
          {canReserve && !bookingToken ? (
            <Link
              to={session?.token && session.phone ? "/event/$slug/products" : "/event/$slug/access"}
              params={{ slug }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
            >
              Browse products <ArrowRight className="h-5 w-5" />
            </Link>
          ) : !canReserve ? (
            <button
              type="button"
              disabled
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-muted px-6 text-base font-semibold text-muted-foreground"
            >
              Reservations unavailable
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
