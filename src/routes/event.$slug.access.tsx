import { createFileRoute, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { eventQueryOptions } from "@/customer/services/queries";
import { verifyAccessCode } from "@/customer/services/eventqueue.functions";
import { useCustomerSession } from "@/shared/hooks/useCustomerSession";
import { generateToken } from "@/shared/lib/token";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/event/$slug/access")({
  loader: async ({ context, params }) => {
    const ev = await context.queryClient.ensureQueryData(eventQueryOptions(params.slug));
    if (!ev) throw notFound();
    return { name: ev.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Enter access code — ${loaderData?.name ?? "EventQueue"}` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const { slug } = Route.useParams();
  const { data: event } = useSuspenseQuery(eventQueryOptions(slug));
  const navigate = useNavigate();
  const { save } = useCustomerSession(slug);
  const verifyFn = useServerFn(verifyAccessCode);

  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const sessionSeed = useMemo(() => {
    if (typeof window === "undefined") return "";
    const existing = localStorage.getItem(`eq:seed:${slug}`);
    if (existing) return existing;
    const s = generateToken(16);
    localStorage.setItem(`eq:seed:${slug}`, s);
    return s;
  }, [slug]);

  const code = digits.join("");

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  async function submit(fullCode: string) {
    if (fullCode.length !== 4 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await verifyFn({ data: { slug, code: fullCode, sessionSeed } });
      if (!res.ok) {
        setError(
          res.error === "rate_limited"
            ? "Too many attempts. Please wait 10 minutes."
            : res.error === "invalid_code"
              ? "That code doesn't match. Check the venue signage and try again."
              : res.error === "event_not_active"
                ? "This event isn't accepting reservations right now."
                : "Something went wrong. Please try again.",
        );
        setDigits(["", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }
      save({ token: res.sessionToken! });
      navigate({ to: "/event/$slug/customer", params: { slug } });
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function setDigit(i: number, v: string) {
    const cleaned = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = cleaned;
      if (cleaned && i < 3) inputs.current[i + 1]?.focus();
      const full = next.join("");
      if (full.length === 4) setTimeout(() => submit(full), 30);
      return next;
    });
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", ""].map((_, i) => text[i] ?? "");
    setDigits(next);
    if (text.length === 4) submit(text);
    else inputs.current[text.length]?.focus();
  }

  return (
    <div className="min-h-screen bg-background">
      <OfflineBanner />
      <main className="mx-auto max-w-md px-4 pt-12">
        <h1 className="text-3xl">Enter access code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the four-character code displayed at the venue for <strong>{event?.name}</strong>.
        </p>

        <div className="mt-8 flex justify-center gap-3" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
              }}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              aria-label={`Digit ${i + 1}`}
              maxLength={1}
              className="h-16 w-14 rounded-xl border-2 border-input bg-card text-center text-2xl font-semibold uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          ))}
        </div>

        {loading && (
          <div className="mt-6 flex justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
          </div>
        )}
        {error && (
          <div role="alert" className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Try code <span className="font-mono font-semibold">A7K9</span> for the demo event.
        </p>
      </main>
    </div>
  );
}