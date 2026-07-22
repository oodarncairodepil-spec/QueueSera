import { Outlet, createFileRoute } from "@tanstack/react-router";
import { eventQueryOptions, productsQueryOptions } from "@/customer/services/queries";

export const Route = createFileRoute("/event/$slug/products")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(eventQueryOptions(params.slug));
    await context.queryClient.ensureQueryData(productsQueryOptions(params.slug));
  },
  head: () => ({ meta: [{ title: "Browse products — EventQueue" }] }),
  component: ProductsLayout,
});

function ProductsLayout() {
  return <Outlet />;
}
