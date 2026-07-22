import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { issueDemoAccessCode } from "@/customer/services/eventqueue.functions";
import { KeyRound, Pause, Play, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/codes")({
  head: () => ({ meta: [{ title: "Access codes — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCodesPage,
});

const DEMO_SLUG = "summer-market-2026";
const INTERVAL_OPTIONS = [5, 10, 15, 30, 60] as const;
const CODE_TTL_MS = 5 * 60_000;

type Mode = "manual" | "auto";

function AdminCodesPage() {
  const issueFn = useServerFn(issueDemoAccessCode);
  const [mode, setMode] = useState<Mode>("manual");
  const [intervalSec, setIntervalSec] = useState<(typeof INTERVAL_OPTIONS)[number]>(15);
  const [autoRunning, setAutoRunning] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [ttlLeft, setTtlLeft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(intervalSec);
  const inFlight = useRef(false);

  const generate = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await issueFn({ data: { slug: DEMO_SLUG } });
      if (!res.ok || !res.code) {
        setError("Failed to generate code.");
        return;
      }
      setCode(res.code);
      setExpiresAt(res.expiresAt ?? new Date(Date.now() + CODE_TTL_MS).toISOString());
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [issueFn]);

  const generateRef = useRef(generate);
  generateRef.current = generate;

  useEffect(() => {
    if (mode !== "auto" || !autoRunning) return;
    let remaining = intervalSec;
    setCountdown(remaining);
    void generateRef.current();

    const tick = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        void generateRef.current();
        remaining = intervalSec;
      }
      setCountdown(remaining);
    }, 1000);

    return () => window.clearInterval(tick);
  }, [mode, autoRunning, intervalSec]);

  useEffect(() => {
    if (!expiresAt) {
      setTtlLeft("");
      return;
    }
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setTtlLeft("Expired");
        return;
      }
      const m = Math.floor(ms / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setTtlLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Access codes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Generator for <span className="font-mono">{DEMO_SLUG}</span> · codes expire in 5 minutes
      </p>

      <div className="mt-6 inline-flex rounded-full bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-full px-4 py-2 font-medium transition-colors ${
            mode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={`rounded-full px-4 py-2 font-medium transition-colors ${
            mode === "auto" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          Auto
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-card p-6 ring-1 ring-border">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest code</div>
        <div className="mt-3 font-mono text-5xl font-bold tracking-[0.25em]">{code ?? "————"}</div>
        {code && ttlLeft && (
          <p className="mt-2 text-sm text-muted-foreground">
            Valid for <span className="font-mono font-semibold text-foreground">{ttlLeft}</span>
          </p>
        )}

        {mode === "manual" ? (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={loading}
            className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Generate 4-digit code
          </button>
        ) : (
          <div className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="font-medium">Interval</span>
              <select
                value={intervalSec}
                onChange={(e) => setIntervalSec(Number(e.target.value) as (typeof INTERVAL_OPTIONS)[number])}
                className="mt-1.5 block w-full max-w-xs rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
              >
                {INTERVAL_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    Every {s} seconds
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoRunning((v) => !v)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-medium"
              >
                {autoRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {autoRunning ? "Pause" : "Resume"}
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {autoRunning ? (
                <>
                  Next code in <span className="font-mono font-semibold text-foreground">{countdown}s</span>
                </>
              ) : (
                "Auto generation paused"
              )}
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
