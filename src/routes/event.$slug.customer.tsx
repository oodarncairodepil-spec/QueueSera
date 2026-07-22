import { createFileRoute, redirect } from "@tanstack/react-router";

// Customer name/phone step removed — go straight to products after access code.
export const Route = createFileRoute("/event/$slug/customer")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/event/$slug/products", params: { slug: params.slug } });
  },
});
