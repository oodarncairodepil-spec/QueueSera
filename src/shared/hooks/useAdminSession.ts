import { useCallback, useEffect, useState } from "react";

const KEY = "eq:admin";
const ALLOWED = "ligar@plugo.co";

export type AdminSession = { email: string; loggedInAt: string };

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminSession;
        if (parsed?.email?.toLowerCase() === ALLOWED) setSession(parsed);
        else localStorage.removeItem(KEY);
      }
    } catch {}
    setLoaded(true);
  }, []);

  const login = useCallback((email: string) => {
    if (email.toLowerCase() !== ALLOWED) return false;
    const next = { email: ALLOWED, loggedInAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(next));
    setSession(next);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  return { session, loaded, login, logout, allowedEmail: ALLOWED };
}
