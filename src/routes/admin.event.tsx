import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getAdminEvent, updateAdminEvent } from "@/customer/services/eventqueue.functions";
import { ExternalLink, Save } from "lucide-react";

export const Route = createFileRoute("/admin/event")({
  head: () => ({ meta: [{ title: "Event setup — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminEventPage,
});

const DEMO_SLUG = "summer-market-2026";

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminEventPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "event", DEMO_SLUG],
    queryFn: () => getAdminEvent({ data: { slug: DEMO_SLUG } }),
  });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setName(data.name ?? "");
    setSlug(data.slug ?? "");
    setDescription(data.description ?? "");
    setBannerUrl(data.banner_url ?? "");
    setStartAt(toDatetimeLocal(data.event_start_at));
    setEndAt(toDatetimeLocal(data.event_end_at));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data?.id) throw new Error("missing");
      return updateAdminEvent({
        data: {
          id: data.id,
          name,
          slug,
          description,
          bannerUrl: bannerUrl || null,
          eventStartAt: new Date(startAt).toISOString(),
          eventEndAt: new Date(endAt).toISOString(),
        },
      });
    },
    onSuccess: async (res) => {
      if (!res.ok) {
        const map: Record<string, string> = {
          slug_taken: "That slug is already used by another event.",
          end_before_start: "End time must be after start time.",
          invalid_dates: "Please enter valid dates.",
          update_failed: "Could not save changes.",
        };
        setError(map[res.error] ?? "Could not save changes.");
        setMessage(null);
        return;
      }
      setError(null);
      setMessage("Event saved.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "event"] });
      if (res.event?.slug && res.event.slug !== DEMO_SLUG) {
        await queryClient.invalidateQueries({ queryKey: ["event"] });
      }
    },
    onError: () => {
      setError("Network error.");
      setMessage(null);
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading event…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-muted-foreground">Event not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Event setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">Homepage content for the customer event page</p>
        </div>
        <Link
          to="/event/$slug"
          params={{ slug: data.slug }}
          className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-2 text-xs font-medium"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Preview
        </Link>
      </div>

      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          setError(null);
          save.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="font-medium">Event name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium">Event URL / slug</span>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">/event/</span>
            <input
              required
              value={slug}
              onChange={(e) =>
                setSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]+/g, "-")
                    .replace(/-+/g, "-")
                    .replace(/^-|-$/g, ""),
                )
              }
              className="w-full rounded-xl border border-input bg-card px-4 py-3 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Start (date & hour)</span>
            <input
              required
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">End (date & hour)</span>
            <input
              required
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="font-medium">Banner image URL</span>
          <input
            type="url"
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="https://…"
            className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">Shown full-width on the event homepage (object-cover, ~h-52–64).</p>
        </label>

        {bannerUrl ? (
          <div className="overflow-hidden rounded-2xl ring-1 ring-border">
            <div className="relative h-40 w-full sm:h-52">
              <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-background/80" />
            </div>
          </div>
        ) : null}

        <label className="block text-sm">
          <span className="font-medium">Event description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-xl border border-input bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-700">{message}</p>}

        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving…" : "Save event"}
        </button>
      </form>
    </main>
  );
}
