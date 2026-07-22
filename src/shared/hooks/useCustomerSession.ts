import { useCallback, useEffect, useState } from "react";

const KEY = (slug: string) => `eq:session:${slug}`;

export interface StoredSession {
  token: string;
  customerName?: string;
  phone?: string;
}

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

const UNLOCK_KEY = (slug: string) => `eq:unlocked:${slug}`;

/** Device has completed access-code verification at least once for this event. */
export function useEventUnlock(slug: string) {
  const [unlocked, setUnlocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      setUnlocked(localStorage.getItem(UNLOCK_KEY(slug)) === "1");
    } catch {}
    setLoaded(true);
  }, [slug]);
  const markUnlocked = useCallback(() => {
    localStorage.setItem(UNLOCK_KEY(slug), "1");
    setUnlocked(true);
  }, [slug]);
  const clearUnlock = useCallback(() => {
    localStorage.removeItem(UNLOCK_KEY(slug));
    setUnlocked(false);
  }, [slug]);
  return { unlocked, loaded, markUnlocked, clearUnlock };
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