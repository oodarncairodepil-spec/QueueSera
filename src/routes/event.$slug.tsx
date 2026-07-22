import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { eventQueryOptions } from "@/customer/services/queries";
import { formatJakarta } from "@/shared/lib/format";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { useCustomerSession, useLastBooking } from "@/shared/hooks/useCustomerSession";
import { ArrowRight, Clock, MapPin, QrCode } from "lucide-react";

export const Route = createFileRoute("/event/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(eventQueryOptions(params.slug));
    if (!data) throw notFound();
    return { name: data.name, description: data.description, banner: data.banner_url };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — EventQueue` },
          { name: "description", content: loaderData.description ?? "Reserve your items before you queue." },
          { property: "og:title", content: `${loaderData.name} — EventQueue` },
          { property: "og:description", content: loaderData.description ?? "Reserve your items before you queue." },
          ...(loaderData.banner
            ? [
                { property: "og:image", content: loaderData.banner },
                { name: "twitter:image", content: loaderData.banner },
              ]
            : []),
        ]
      : [{ title: "Event not found" }, { name: "robots", content: "noindex" }],
  }),
  component: EventLanding,
});

function EventLanding() {
  const { slug } = Route.useParams();
  const { data: event } = useSuspenseQuery(eventQueryOptions(slug));
  const { session } = useCustomerSession(slug);
  const { token: bookingToken } = useLastBooking(slug);

  if (!event) return null;
  const now = Date.now();
  const openAt = new Date(event.reservation_open_at).getTime();
  const closeAt = new Date(event.reservation_close_at).getTime();
  const stateBanner = (() => {
    if (event.status === "paused")
      return { tone: "warn", text: "Reservations are temporarily paused by the event organizer." };
    if (event.status === "closed" || event.status === "completed")
      return { tone: "muted", text: "Reservations for this event are closed." };
    if (event.status === "cancelled")
      return { tone: "warn", text: "This event has been cancelled." };
    if (now < openAt)
      return { tone: "muted", text: `Reservations have not opened yet. Opens ${formatJakarta(event.reservation_open_at)}.` };
    if (now > closeAt) return { tone: "muted", text: "Reservations for this event are closed." };
    return null;
  })();
  const canReserve = event.status === "active" && !stateBanner;
  const seller: any = (event as any).seller;

  return (
    <div className="min-h-screen bg-background pb-24">
      <OfflineBanner />
      {event.banner_url && (
        <div className="relative h-48 w-full overflow-hidden sm:h-64">
          <img src={event.banner_url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/95" />
        </div>
      )}
      <main className="mx-auto -mt-10 max-w-xl px-4">
        <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
          {seller?.logo_url && (
            <div className="mb-3 flex items-center gap-2">
              <img src={seller.logo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-sm font-medium text-muted-foreground">{seller.name}</span>
            </div>
          )}
          <h1 className="text-3xl leading-tight">{event.name}</h1>
          {event.description && <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>}

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="sr-only">Venue</dt>
                <dd className="font-medium">{event.venue_name}</dd>
                {event.venue_address && <dd className="text-muted-foreground">{event.venue_address}</dd>}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="sr-only">When</dt>
                <dd>{formatJakarta(event.event_start_at)} — {formatJakarta(event.event_end_at)}</dd>
                <dd className="text-muted-foreground">
                  Reservations {formatJakarta(event.reservation_open_at)} – {formatJakarta(event.reservation_close_at)} WIB
                </dd>
              </div>
            </div>
          </dl>

          {stateBanner && (
            <div className={`mt-5 rounded-lg p-3 text-sm ${stateBanner.tone === "warn" ? "bg-warning/20" : "bg-muted"}`}>
              {stateBanner.text}
            </div>
          )}
        </div>

        {bookingToken && (
          <Link
            to="/event/$slug/booking/$token"
            params={{ slug, token: bookingToken }}
            className="mt-4 flex items-center justify-between rounded-2xl bg-accent p-4 text-accent-foreground ring-1 ring-border"
          >
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide">You have a booking</div>
              <div className="text-sm">Tap to view your queue number</div>
            </div>
            <QrCode className="h-6 w-6" />
          </Link>
        )}

        <div className="mt-6">
          {canReserve ? (
            <Link
              to={session ? "/event/$slug/products" : "/event/$slug/access"}
              params={{ slug }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98]"
            >
              {session ? "Browse products" : "Continue"} <ArrowRight className="h-5 w-5" />
            </Link>
          ) : (
            <button
              disabled
              className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-muted px-6 text-base font-semibold text-muted-foreground"
            >
              Reservations unavailable
            </button>
          )}
        </div>
      </main>
    </div>
  );
}