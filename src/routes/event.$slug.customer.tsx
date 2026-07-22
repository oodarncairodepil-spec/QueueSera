import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { saveCustomerInfo } from "@/customer/services/eventqueue.functions";
import { useCustomerSession } from "@/shared/hooks/useCustomerSession";
import { OfflineBanner } from "@/customer/components/OfflineBanner";

export const Route = createFileRoute("/event/$slug/customer")({
  head: () => ({ meta: [{ title: "Your details — EventQueue" }, { name: "robots", content: "noindex" }] }),
  component: CustomerPage,
});

function CustomerPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { session, loaded, save } = useCustomerSession(slug);
  const saveFn = useServerFn(saveCustomerInfo);

  useEffect(() => {
    if (loaded && !session) navigate({ to: "/event/$slug/access", params: { slug } });
  }, [loaded, session, slug, navigate]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(skip = false) {
    if (!session) return;
    setBusy(true);
    try {
      if (!skip) await saveFn({ data: { sessionToken: session.token, customerName: name || undefined, phone: phone || undefined } });
      if (name) save({ ...session, customerName: name });
      navigate({ to: "/event/$slug/products", params: { slug } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <OfflineBanner />
      <main className="mx-auto max-w-md px-4 pt-10">
        <h1 className="text-3xl">One quick thing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Give the cashier a name to call. This is optional and never shared.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">Name or nickname</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="mt-1 w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-base focus:border-primary focus:outline-none"
              placeholder="e.g. Andi"
              autoComplete="given-name"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Phone <span className="text-muted-foreground">(optional)</span></span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              inputMode="tel"
              className="mt-1 w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-base focus:border-primary focus:outline-none"
              placeholder="e.g. 0812 3456 7890"
              autoComplete="tel"
            />
          </label>
        </form>
      </main>
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-card/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
            className="flex-1 min-h-[52px] rounded-xl border-2 border-input bg-transparent px-4 text-base font-semibold"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={busy}
            className="flex-[2] min-h-[52px] rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground"
          >
            {busy ? "Saving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}