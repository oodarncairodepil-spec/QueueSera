-- One-time access codes + 24h reservation window
ALTER TABLE public.customer_sessions
  ADD COLUMN IF NOT EXISTS access_code_id UUID REFERENCES public.event_access_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS customer_sessions_access_code_idx
  ON public.customer_sessions(access_code_id);

-- 24 hours for new reservations
UPDATE public.events
SET reservation_duration_minutes = 1440
WHERE reservation_duration_minutes < 1440;

-- Extend open reserved bookings to the new 24h window
UPDATE public.bookings
SET expires_at = reserved_at + interval '24 hours'
WHERE status = 'reserved'
  AND expires_at < reserved_at + interval '24 hours';

-- Extra demo access codes (one-time each after a successful booking)
INSERT INTO public.event_access_codes (event_id, code_hash, active)
SELECT e.id, encode(digest(c.code, 'sha256'), 'hex'), true
FROM public.events e
CROSS JOIN (VALUES
  ('B2C4'),
  ('D5E6'),
  ('F7G8'),
  ('H9J0'),
  ('K1L2'),
  ('M3N4'),
  ('P5Q6'),
  ('R7S8'),
  ('T9U0'),
  ('V1W2')
) AS c(code)
WHERE e.slug = 'summer-market-2026'
  AND NOT EXISTS (
    SELECT 1 FROM public.event_access_codes existing
    WHERE existing.event_id = e.id
      AND existing.code_hash = encode(digest(c.code, 'sha256'), 'hex')
  );
