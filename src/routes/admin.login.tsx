import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAdminSession } from "@/shared/hooks/useAdminSession";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin login — EventQueue" }, { name: "robots", content: "noindex" }] }),
  component: AdminLoginPage,
});

type Phase = "idle" | "loading" | "picker" | "selecting" | "signing";

const DUMMY_ACCOUNTS = [
  { email: "ligar@plugo.co", name: "Ligar Plugo", initial: "L", color: "#1a73e8" },
  { email: "ops@example.com", name: "Ops Demo", initial: "O", color: "#ea4335", disabled: true },
] as const;

function GoogleMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const { session, loaded, login, allowedEmail } = useAdminSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (loaded && session) navigate({ to: "/admin/codes" });
  }, [loaded, session, navigate]);

  useEffect(() => {
    if (phase !== "picker") return;
    const t1 = window.setTimeout(() => setHighlight(true), 180);
    const t2 = window.setTimeout(() => setPhase("selecting"), 420);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "selecting") return;
    const t1 = window.setTimeout(() => setPhase("signing"), 280);
    return () => window.clearTimeout(t1);
  }, [phase]);

  useEffect(() => {
    if (phase !== "signing") return;
    const t1 = window.setTimeout(() => {
      const ok = login(allowedEmail);
      if (ok) navigate({ to: "/admin/codes" });
      else {
        setPhase("idle");
        setHighlight(false);
      }
    }, 350);
    return () => window.clearTimeout(t1);
  }, [phase, login, allowedEmail, navigate]);

  function startDummyGoogle() {
    if (phase !== "idle") return;
    setHighlight(false);
    setPhase("loading");
    window.setTimeout(() => setPhase("picker"), 280);
  }

  function cancelPicker() {
    if (phase === "signing" || phase === "selecting") return;
    setPhase("idle");
    setHighlight(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
        <h1 className="text-2xl font-semibold">Admin login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Temporary dummy Google SSO until real auth is wired.
        </p>

        <button
          type="button"
          onClick={startDummyGoogle}
          disabled={phase !== "idle"}
          className="mt-8 flex min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-muted disabled:opacity-60"
        >
          <GoogleMark />
          Continue with Google
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Allowed account: <span className="font-mono font-semibold">{allowedEmail}</span>
        </p>
      </div>

      {phase !== "idle" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          style={{ animation: "adminFadeIn 180ms ease-out" }}
          role="dialog"
          aria-modal="true"
          aria-label="Choose a Google account"
          onClick={cancelPicker}
        >
          <style>{`
            @keyframes adminFadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes adminPopIn { from { opacity: 0; transform: scale(0.96) translateY(8px) } to { opacity: 1; transform: scale(1) translateY(0) } }
            @keyframes adminPulseSelect { 0%, 100% { box-shadow: 0 0 0 0 rgba(26,115,232,0.35) } 50% { box-shadow: 0 0 0 6px rgba(26,115,232,0) } }
          `}</style>
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-[#202124] shadow-2xl"
            style={{ animation: "adminPopIn 220ms ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            {phase === "loading" || phase === "signing" ? (
              <div className="flex flex-col items-center gap-4 px-6 py-12">
                <GoogleMark className="h-8 w-8" />
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
                <p className="text-sm text-[#5f6368]">
                  {phase === "loading" ? "Connecting to Google…" : "Signing you in…"}
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-[#dadce0] px-6 py-5 text-center">
                  <GoogleMark className="mx-auto h-6 w-6" />
                  <h2 className="mt-3 text-lg font-medium">Choose an account</h2>
                  <p className="mt-1 text-sm text-[#5f6368]">to continue to EventQueue Admin</p>
                </div>
                <ul className="divide-y divide-[#dadce0]">
                  {DUMMY_ACCOUNTS.map((acc) => {
                    const isTarget = acc.email === allowedEmail;
                    const active = isTarget && (highlight || phase === "selecting");
                    return (
                      <li key={acc.email}>
                        <button
                          type="button"
                          disabled={"disabled" in acc && acc.disabled}
                          className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-all duration-300 ${
                            active ? "bg-[#e8f0fe]" : "hover:bg-[#f8f9fa]"
                          } ${"disabled" in acc && acc.disabled ? "cursor-not-allowed opacity-45" : ""}`}
                          style={active ? { animation: "adminPulseSelect 1s ease-in-out infinite" } : undefined}
                          onClick={() => {
                            if (!isTarget || phase !== "picker") return;
                            setHighlight(true);
                            setPhase("selecting");
                          }}
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white transition-transform duration-300 ${
                              active ? "scale-110 ring-2 ring-[#1a73e8] ring-offset-2" : ""
                            }`}
                            style={{ backgroundColor: acc.color }}
                          >
                            {acc.initial}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{acc.name}</span>
                            <span className="block truncate text-xs text-[#5f6368]">{acc.email}</span>
                          </span>
                          {active && phase === "selecting" && (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a73e8] border-t-transparent" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-[#dadce0] px-5 py-3 text-xs text-[#5f6368]">
                  Use another account
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
