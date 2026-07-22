import { useCallback, useEffect, useState } from "react";

const KEY = (slug: string) => `eq:session:${slug}`;

export interface StoredSession { token: string; customerName?: string; }

export function useCustomerSession(slug: string) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(slug));
      if (raw) setSession(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, [slug]);
  const save = useCallback((s: StoredSession) => {
    localStorage.setItem(KEY(slug), JSON.stringify(s));
    setSession(s);
  }, [slug]);
  const clear = useCallback(() => {
    localStorage.removeItem(KEY(slug));
    setSession(null);
  }, [slug]);
  return { session, loaded, save, clear };
}

const BOOKING_KEY = (slug: string) => `eq:booking:${slug}`;
export function useLastBooking(slug: string) {
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { setToken(localStorage.getItem(BOOKING_KEY(slug))); } catch {}
    setLoaded(true);
  }, [slug]);
  const save = useCallback((t: string) => {
    localStorage.setItem(BOOKING_KEY(slug), t);
    setToken(t);
  }, [slug]);
  const clear = useCallback(() => {
    localStorage.removeItem(BOOKING_KEY(slug));
    setToken(null);
  }, [slug]);
  return { token, loaded, save, clear };
}