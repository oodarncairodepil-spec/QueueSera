import { Outlet, createFileRoute, notFound } from "@tanstack/react-router";
import { eventQueryOptions } from "@/customer/services/queries";

// Layout route: child pages (index, access, products, …) render via <Outlet />.
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
  component: EventLayout,
});

function EventLayout() {
  return <Outlet />;
}
