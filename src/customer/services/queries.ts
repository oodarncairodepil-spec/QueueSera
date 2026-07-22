import { queryOptions } from "@tanstack/react-query";
import { getBookingByToken, getEventBySlug, getEventProduct, listEventProducts, getQueueSnapshot } from "./eventqueue.functions";

export const eventQueryOptions = (slug: string) =>
  queryOptions({ queryKey: ["event", slug], queryFn: () => getEventBySlug({ data: { slug } }), staleTime: 30_000 });

export const productsQueryOptions = (slug: string) =>
  queryOptions({ queryKey: ["event", slug, "products"], queryFn: () => listEventProducts({ data: { slug } }), staleTime: 15_000 });

export const productQueryOptions = (slug: string, productId: string) =>
  queryOptions({ queryKey: ["event", slug, "product", productId], queryFn: () => getEventProduct({ data: { slug, productId } }), staleTime: 10_000 });

export const bookingQueryOptions = (token: string) =>
  queryOptions({ queryKey: ["booking", token], queryFn: () => getBookingByToken({ data: { token } }), staleTime: 5_000 });

export const queueSnapshotQueryOptions = (eventId: string) =>
  queryOptions({ queryKey: ["queue", eventId], queryFn: () => getQueueSnapshot({ data: { eventId } }), staleTime: 5_000 });