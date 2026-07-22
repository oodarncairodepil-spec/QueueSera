import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { eventQueryOptions, productsQueryOptions } from "@/customer/services/queries";
import { issueDemoAccessCode, saveCustomerInfo, verifyAccessCode } from "@/customer/services/eventqueue.functions";
import { useCustomerSession, useEventUnlock } from "@/shared/hooks/useCustomerSession";
import { generateToken } from "@/shared/lib/token";
import { OfflineBanner } from "@/customer/components/OfflineBanner";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";

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
  const queryClient = useQueryClient();
  const { session, loaded, save } = useCustomerSession(slug);
  const { markUnlocked } = useEventUnlock(slug);
  const verifyFn = useServerFn(verifyAccessCode);
  const saveInfoFn = useServerFn(saveCustomerInfo);
  const issueCodeFn = useServerFn(issueDemoAccessCode);

  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [phone, setPhone] = useState("08");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const sessionSeed = useMemo(() => {
    if (typeof window === "undefined") return "";
    const existing = localStorage.getItem(`eq:seed:${slug}`);
    if (existing) return existing;
    const s = generateToken(16);
    localStorage.setItem(`eq:seed:${slug}`, s);
    return s;
  }, [slug]);

  // Already signed in → go browse (don't ask again).
  useEffect(() => {
    if (loaded && session?.token && session.phone) {
      navigate({ to: "/event/$slug/products", params: { slug } });
    }
  }, [loaded, session, slug, navigate]);

  async function loadDemoCode(autofill = true) {
    setIssuing(true);
    setError(null);
    try {
      const res = await issueCodeFn({ data: { slug } });
      if (!res.ok || !res.code) {
        setError("Could not generate a demo code. Please try again.");
        return;
      }
      setDemoCode(res.code);
      if (autofill) {
        setDigits(res.code.split(""));
      }
    } catch {
      setError("Could not generate a demo code. Please try again.");
    } finally {
      setIssuing(false);
      inputs.current[0]?.focus();
    }
  }

  useEffect(() => {
    if (!loaded) return;
    if (session?.token && session.phone) return;
    void loadDemoCode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, slug]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;

    const fullCode = digits.join("");
    const digitsOnly = phone.replace(/\D/g, "");
    if (fullCode.length !== 4) {
      setError("Please enter the 4-character access code.");
      return;
    }
    // 08 + 9..11 additional digits → total length 11..13
    if (!/^08\d{9,11}$/.test(digitsOnly)) {
      setError("Enter a valid phone starting with 08 (9–11 more digits).");
      return;
    }
    const trimmedPhone = digitsOnly;

    setLoading(true);
    setError(null);
    try {
      const verified = await verifyFn({ data: { slug, code: fullCode, sessionSeed } });
      if (!verified.ok) {
        setError(
          verified.error === "rate_limited"
            ? "Too many attempts. Please wait 10 minutes."
            : verified.error === "invalid_code"
              ? "That code doesn't match. Tap “Generate new code” and try again."
              : verified.error === "event_not_active"
                ? "This event isn't accepting reservations right now."
                : "Something went wrong. Please try again.",
        );
        setDigits(["", "", "", ""]);
        inputs.current[0]?.focus();
        setLoading(false);
        return;
      }

      const saved = await saveInfoFn({
        data: { sessionToken: verified.sessionToken!, phone: trimmedPhone },
      });
      if (!saved.ok) {
        setError(saved.error === "invalid_phone" ? "Please enter a valid phone number." : "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      save({ token: verified.sessionToken!, phone: saved.phone! });
      markUnlocked();
      await queryClient.prefetchQuery(productsQueryOptions(slug));
      await navigate({ to: "/event/$slug/products", params: { slug } });
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
    }
  }

  function setDigit(i: number, v: string) {
    const cleaned = v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = cleaned;
      if (cleaned && i < 3) inputs.current[i + 1]?.focus();
      return next;
    });
  }

  function onPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData("text").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", ""].map((_, i) => text[i] ?? "");
    setDigits(next);
    if (text.length === 4) document.getElementById("phone")?.focus();
    else inputs.current[text.length]?.focus();
  }

  if (loaded && session?.token && session.phone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      <OfflineBanner />
      <header className="flex items-center px-2 py-2">
        <Link
          to="/event/$slug"
          params={{ slug }}
          aria-label="Back to homepage"
          className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </header>
      <main className="mx-auto max-w-md px-4 pt-4">
        <h1 className="text-3xl">Enter access details</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the venue code and your phone number for <strong>{event?.name}</strong>.
        </p>

        <div className="mt-6 rounded-2xl bg-accent/50 p-4 ring-1 ring-border">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Temporary demo code
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="font-mono text-3xl font-bold tracking-[0.2em]">
              {issuing ? "····" : demoCode ?? "————"}
            </div>
            <button
              type="button"
              onClick={() => loadDemoCode(true)}
              disabled={issuing || loading}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-input bg-card px-3 text-xs font-medium disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${issuing ? "animate-spin" : ""}`} />
              Generate new
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Until the admin app can mint codes, use this generated code (one-time after booking).
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={submit}>
          <div>
            <label className="mb-2 block text-sm font-medium">Access code</label>
            <div className="flex justify-center gap-3" onPaste={onPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
                    if (e.key === "Enter") submit();
                  }}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  aria-label={`Digit ${i + 1}`}
                  maxLength={1}
                  disabled={loading}
                  className="h-16 w-14 rounded-xl border-2 border-input bg-card text-center text-2xl font-semibold uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium" htmlFor="phone">
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                // Always keep 08 prefix; allow 9–11 extra digits (total 11–13).
                let next = raw.startsWith("08") ? raw : `08${raw.replace(/^0+/, "")}`;
                if (!next.startsWith("08")) next = "08";
                next = next.slice(0, 13);
                setPhone(next);
              }}
              onBlur={() => {
                if (!phone.startsWith("08")) setPhone("08");
              }}
              onKeyDown={(e) => {
                // Block deleting below the fixed "08" prefix
                const el = e.currentTarget;
                const selStart = el.selectionStart ?? 0;
                const selEnd = el.selectionEnd ?? 0;
                if (
                  (e.key === "Backspace" || e.key === "Delete") &&
                  selStart <= 2 &&
                  selEnd <= 2 &&
                  phone.length <= 2
                ) {
                  e.preventDefault();
                }
                if (e.key === "Backspace" && selStart <= 2 && selEnd <= 2) {
                  e.preventDefault();
                }
              }}
              placeholder="08xxxxxxxxxx"
              disabled={loading}
              className="w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Starts with 08 · add 9–11 more digits</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[52px] w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground disabled:opacity-50"
          >
            Continue
          </button>
        </form>

        {error && (
          <div role="alert" className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </main>

      {loading && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">Loading products…</p>
          <p className="text-xs text-muted-foreground">Please wait a moment</p>
        </div>
      )}
    </div>
  );
}
