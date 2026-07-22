import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { eventQueryOptions } from "@/customer/services/queries";
import { createBooking } from "@/customer/services/eventqueue.functions";
import { useCustomerSession, useLastBooking } from "@/shared/hooks/useCustomerSession";
import { useCart } from "@/shared/hooks/useCart";
import { useOnline } from "@/shared/hooks/useOnline";
import { generateToken } from "@/shared/lib/token";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { formatIDR } from "@/shared/lib/format";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/event/$slug/cart")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(eventQueryOptions(params.slug)),
  head: () => ({ meta: [{ title: "Your cart — EventQueue" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { data: event } = useSuspenseQuery(eventQueryOptions(slug));
  const { session, loaded } = useCustomerSession(slug);
  const { save: saveLastBooking } = useLastBooking(slug);
  const cart = useCart(slug);
  const online = useOnline();
  const createFn = useServerFn(createBooking);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => (typeof window !== "undefined" ? generateToken(16) : ""));

  useEffect(() => {
    if (loaded && !session) navigate({ to: "/event/$slug/access", params: { slug } });
  }, [loaded, session, slug, navigate]);

  async function confirm() {
    if (!session || submitting || !online || cart.items.length === 0) return;
    setSubmitting(true);
    setError(null);
    const bookingToken = generateToken(32);
    try {
      const res = await createFn({
        data: {
          slug,
          sessionToken: session.token,
          idempotencyKey,
          bookingToken,
          items: cart.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        },
      });
      if (!res.ok) {
        setError(
          res.error?.startsWith("insufficient_stock")
            ? "One or more items are no longer available. Please review your cart."
            : res.error === "reservations_closed"
              ? "Reservations for this event have closed."
              : res.error === "event_not_active"
                ? "This event isn't accepting reservations."
                : res.error === "exceeds_customer_limit"
                  ? "You've exceeded the maximum items per customer."
                  : "Something went wrong. Please try again.",
        );
        return;
      }
      saveLastBooking(res.bookingToken!);
      cart.clear();
      navigate({ to: "/event/$slug/booking/$token", params: { slug, token: res.bookingToken! } });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <OfflineBanner />
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <Link
          to="/event/$slug/products"
          params={{ slug }}
          aria-label="Back to products"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-medium">Your cart</h1>
      </header>

      <main className="mx-auto max-w-xl px-4 pt-4">
        {cart.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Link
              to="/event/$slug/products"
              params={{ slug }}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {cart.items.map((it) => (
              <li key={it.variantId} className="flex gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
                {it.imageUrl && <img src={it.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="text-sm font-medium">{it.productName}</div>
                  <div className="text-xs text-muted-foreground">{it.variantName}{it.sku ? ` · ${it.sku}` : ""}</div>
                  <div className="mt-1 text-sm font-semibold">{formatIDR(it.unitPrice)}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 rounded-full bg-background ring-1 ring-border">
                      <button aria-label="Decrease" onClick={() => cart.update(it.variantId, it.quantity - 1)} className="flex h-9 w-9 items-center justify-center">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">{it.quantity}</span>
                      <button aria-label="Increase" onClick={() => cart.update(it.variantId, it.quantity + 1)} className="flex h-9 w-9 items-center justify-center">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      aria-label="Remove item"
                      onClick={() => cart.remove(it.variantId)}
                      className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {cart.items.length > 0 && (
          <>
            <div className="mt-6 rounded-2xl bg-accent/40 p-4 text-sm">
              Your items are not recorded until you confirm your booking. Final availability and purchase
              confirmation will be handled by the cashier and POS system.
            </div>
            {error && (
              <div role="alert" className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </>
        )}
      </main>

      {cart.items.length > 0 && event && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-xl">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Estimated total</span>
              <span className="text-xl font-bold">{formatIDR(cart.subtotal)}</span>
            </div>
            <button
              onClick={confirm}
              disabled={submitting || !online}
              className="flex w-full min-h-[52px] items-center justify-center rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Confirming…" : online ? "Confirm booking" : "You're offline"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}