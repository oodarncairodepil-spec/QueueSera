import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/event/$slug/closed")({
  head: () => ({ meta: [{ title: "Event closed — EventQueue" }, { name: "robots", content: "noindex" }] }),
  component: () => {
    const { slug } = Route.useParams();
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-3xl">Reservations are closed</h1>
          <p className="mt-2 text-sm text-muted-foreground">This event is no longer accepting new bookings.</p>
          <Link
            to="/event/$slug"
            params={{ slug }}
            className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Back to event
          </Link>
        </div>
      </div>
    );
  },
});