import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";

// EventQueue redirects the root to the active demo event. In production, customers
// arrive via a venue QR pointing directly at /event/:slug.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/event/$slug", params: { slug: "summer-market-2026" } });
  },
});
